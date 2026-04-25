/**
 * UniProfile — Groups Module
 *
 * DEPLOY INSTRUCTIONS
 * ───────────────────
 * 1. Run the SQL migration below once against your Aurora PostgreSQL instance.
 * 2. In your main profile Lambda handler:
 *    a. require this module:
 *         const { handleGroupsModule, getGroupsForProfile } = require('./groups-module');
 *    b. Inside GET /api/v1/me (or wherever you build the profile response),
 *       add groups to the returned object:
 *         profile.groups = await getGroupsForProfile(uuid, pool);
 *    c. Inside PUT /api/v1/profile/{uuid}, add a case for module === 'groups':
 *         if (module === 'groups') {
 *           return await handleGroupsModule(uuid, data, pool);
 *         }
 *
 * ── SQL Migration (run once) ─────────────────────────────────────────────────
 *
 * CREATE TABLE IF NOT EXISTS traveler_groups (
 *   id           TEXT        NOT NULL,
 *   owner_uuid   UUID        NOT NULL,
 *   name         TEXT        NOT NULL,
 *   type         TEXT        NOT NULL DEFAULT 'other',
 *   destination  TEXT,
 *   dep          DATE,
 *   ret          DATE,
 *   members      JSONB       NOT NULL DEFAULT '[]',
 *   flights      JSONB       NOT NULL DEFAULT '[]',
 *   hotel        JSONB,
 *   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY  (id, owner_uuid)
 * );
 * CREATE INDEX ON traveler_groups (owner_uuid, updated_at DESC);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Load all groups for a traveler.
 * Call this in GET /api/v1/me to include groups in the profile response.
 *
 * @param {string} ownerUuid
 * @param {import('pg').Pool} pool
 * @returns {Promise<Array>}
 */
async function getGroupsForProfile(ownerUuid, pool) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, destination,
              dep::text, ret::text,
              members, flights, hotel
         FROM traveler_groups
        WHERE owner_uuid = $1
        ORDER BY updated_at DESC`,
      [ownerUuid]
    );
    return rows.map(r => ({
      id:          r.id,
      name:        r.name,
      type:        r.type,
      destination: r.destination,
      dep:         r.dep,
      ret:         r.ret,
      members:     r.members,
      flights:     r.flights,
      hotel:       r.hotel,
    }));
  } catch (err) {
    console.error('getGroupsForProfile error:', err.message);
    return [];
  }
}

/**
 * Upsert the full groups array for a traveler.
 * Called from PUT /api/v1/profile/{uuid} when module === 'groups'.
 *
 * @param {string} ownerUuid
 * @param {{ groups: Array }} data  — the `data` field from the PUT body
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function handleGroupsModule(ownerUuid, data, pool) {
  const groups = Array.isArray(data && data.groups) ? data.groups : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove any groups no longer in the payload
    const incomingIds = groups.map(g => g.id).filter(Boolean);
    if (incomingIds.length > 0) {
      await client.query(
        `DELETE FROM traveler_groups
          WHERE owner_uuid = $1
            AND id <> ALL($2::text[])`,
        [ownerUuid, incomingIds]
      );
    } else {
      await client.query(
        `DELETE FROM traveler_groups WHERE owner_uuid = $1`,
        [ownerUuid]
      );
    }

    // Upsert each group
    for (const g of groups) {
      if (!g.id) continue;
      await client.query(
        `INSERT INTO traveler_groups
           (id, owner_uuid, name, type, destination, dep, ret, members, flights, hotel, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, NOW())
         ON CONFLICT (id, owner_uuid) DO UPDATE SET
           name        = EXCLUDED.name,
           type        = EXCLUDED.type,
           destination = EXCLUDED.destination,
           dep         = EXCLUDED.dep,
           ret         = EXCLUDED.ret,
           members     = EXCLUDED.members,
           flights     = EXCLUDED.flights,
           hotel       = EXCLUDED.hotel,
           updated_at  = NOW()`,
        [
          g.id,
          ownerUuid,
          g.name        || '',
          g.type        || 'other',
          g.destination || null,
          g.dep         || null,
          g.ret         || null,
          JSON.stringify(g.members  || []),
          JSON.stringify(g.flights  || []),
          g.hotel ? JSON.stringify(g.hotel) : null,
        ]
      );
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('handleGroupsModule error:', err.message);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

module.exports = { getGroupsForProfile, handleGroupsModule };
