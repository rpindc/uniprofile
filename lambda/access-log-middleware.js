/**
 * UniProfile — Access Log Middleware & Endpoint
 *
 * DEPLOY INSTRUCTIONS
 * ───────────────────
 * 1. Run the SQL below in your Aurora PostgreSQL 16.4 instance once.
 * 2. Copy logProfileAccess() into your existing profile Lambda handler
 *    and call it inside the GET /api/v1/profile/{uuid} route handler,
 *    right after the profile is fetched and before the response is sent.
 * 3. Register the accessLogHandler as a new Lambda route:
 *    GET /api/v1/access-log/{uuid}
 * 4. Register getConnectedPlatformsHandler as:
 *    GET /api/v1/platforms/{uuid}
 *
 * ── SQL (run once) ──────────────────────────────────────────────────────────
 *
 * CREATE TABLE IF NOT EXISTS access_log (
 *   id              BIGSERIAL PRIMARY KEY,
 *   traveler_uuid   UUID        NOT NULL,
 *   platform_id     TEXT        NOT NULL,
 *   platform_name   TEXT        NOT NULL,
 *   accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   fields_accessed TEXT[]      NOT NULL DEFAULT '{}',
 *   ip_address      INET
 * );
 * CREATE INDEX ON access_log (traveler_uuid, platform_id, accessed_at DESC);
 *
 * CREATE TABLE IF NOT EXISTS connected_platforms (
 *   id            TEXT        NOT NULL,
 *   traveler_uuid UUID        NOT NULL,
 *   name          TEXT        NOT NULL,
 *   scope         TEXT,
 *   icon          TEXT,
 *   icon_bg       TEXT,
 *   connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY (id, traveler_uuid)
 * );
 * ────────────────────────────────────────────────────────────────────────────
 */

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Field name map — translate internal keys to human-readable labels
const FIELD_LABELS = {
  legal_first:          "Legal first name",
  legal_last:           "Legal last name",
  dob:                  "Date of birth",
  nationality:          "Nationality",
  gender_code:          "Gender",
  home_airport:         "Home airport",
  documents:            "Documents",
  seat_preferences:     "Seat preferences",
  meal_preferences:     "Meal code",
  loyalty_programs:     "Loyalty numbers",
  payment:              "Payment method",
  trips:                "Trip history",
  family:               "Family links",
  consent:              "Consent records",
};

/**
 * Call this inside GET /api/v1/profile/{uuid} after fetching the profile.
 *
 * @param {string} travelerUuid  - The profile owner's UUID
 * @param {string} platformId    - Caller's platform ID (from API key / JWT claim)
 * @param {string} platformName  - Human-readable name (from API key record)
 * @param {string[]} fieldsRequested - Keys present in the query or response
 * @param {string} ipAddress     - event.requestContext.identity.sourceIp
 */
async function logProfileAccess(travelerUuid, platformId, platformName, fieldsRequested, ipAddress) {
  const labels = fieldsRequested
    .filter(f => FIELD_LABELS[f])
    .map(f => FIELD_LABELS[f]);
  try {
    await pool.query(
      `INSERT INTO access_log (traveler_uuid, platform_id, platform_name, fields_accessed, ip_address)
       VALUES ($1, $2, $3, $4, $5::inet)`,
      [travelerUuid, platformId, platformName, labels, ipAddress || null]
    );
  } catch (err) {
    // Non-fatal — log to CloudWatch but never block the profile response
    console.error("access_log insert failed:", err.message);
  }
}

/**
 * GET /api/v1/access-log/{uuid}?platform_id=&limit=10
 * Returns the last N access events for a traveler, optionally filtered by platform.
 */
async function accessLogHandler(event) {
  const travelerUuid = event.pathParameters.uuid;
  const platformId   = event.queryStringParameters?.platform_id || null;
  const limit        = Math.min(parseInt(event.queryStringParameters?.limit || "10", 10), 50);

  const params = [travelerUuid, limit];
  let where = "WHERE traveler_uuid = $1";
  if (platformId) { where += " AND platform_id = $3"; params.push(platformId); }

  const { rows } = await pool.query(
    `SELECT platform_id, platform_name, accessed_at, fields_accessed
     FROM access_log ${where}
     ORDER BY accessed_at DESC LIMIT $2`,
    params
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ logs: rows }),
  };
}

/**
 * GET /api/v1/platforms/{uuid}
 * Returns all platforms a traveler has connected.
 */
async function getConnectedPlatformsHandler(event) {
  const travelerUuid = event.pathParameters.uuid;
  const { rows } = await pool.query(
    `SELECT id, name, scope, icon, icon_bg, connected_at
     FROM connected_platforms WHERE traveler_uuid = $1
     ORDER BY connected_at ASC`,
    [travelerUuid]
  );
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ platforms: rows }),
  };
}

module.exports = { logProfileAccess, accessLogHandler, getConnectedPlatformsHandler };
