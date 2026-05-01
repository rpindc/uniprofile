// UniProfile — Email Ingest Lambda
// Trigger: S3 PutObject on the uniprofile-emails bucket (SES receipt rule drops raw MIME there)
// Flow: raw email → MIME parse → traveler lookup by From: → Claude Haiku extract → trips insert

const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const rds = new RDSDataClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3  = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const sm  = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });

const DB = {
  resourceArn: process.env.AURORA_CLUSTER_ARN,
  secretArn:   process.env.AURORA_SECRET_ARN,
  database:    process.env.DB_NAME || "uniprofile",
};

async function sql(query, params = []) {
  try {
    const res = await rds.send(new ExecuteStatementCommand({ ...DB, sql: query, parameters: params, formatRecordsAs: "JSON" }));
    return res.formattedRecords ? JSON.parse(res.formattedRecords) : [];
  } catch (e) {
    console.error("SQL error:", e.message, "Q:", query.slice(0, 100));
    throw e;
  }
}

const strParam  = (n, v) => ({ name: n, value: (v != null && v !== "" && v !== "null") ? { stringValue: String(v) } : { isNull: true } });
const uuidParam = (n, v) => ({ name: n, value: { stringValue: v }, typeHint: "UUID" });
const dateParam = (n, v) => (v && v !== "" && v !== "null") ? { name: n, value: { stringValue: String(v) }, typeHint: "DATE" } : { name: n, value: { isNull: true } };
const numParam  = (n, v) => ({ name: n, value: v != null ? { doubleValue: Number(v) } : { isNull: true } });
const intParam  = (n, v) => ({ name: n, value: v != null ? { longValue: Number(v) } : { isNull: true } });

// ── MIME parser ───────────────────────────────────────────────────────────────
// Handles flat emails and multipart/alternative, multipart/mixed.
// Returns { fromEmail, subject, text } where text is the best plaintext we can get.
function parseMime(raw) {
  const normalised = raw.replace(/\r\n/g, "\n");
  const headerEnd = normalised.indexOf("\n\n");
  const headerBlock = headerEnd > -1 ? normalised.slice(0, headerEnd) : normalised;
  const bodyBlock   = headerEnd > -1 ? normalised.slice(headerEnd + 2) : "";

  // Unfold headers (continuation lines start with whitespace)
  const unfolded = headerBlock.replace(/\n[ \t]+/g, " ");
  const headers = {};
  for (const line of unfolded.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).toLowerCase().trim();
    const val = line.slice(colon + 1).trim();
    if (!headers[key]) headers[key] = val;
  }

  const toHeader   = headers["to"]   || "";
  const subjectRaw = headers["subject"] || "";
  const subject    = decodeEncodedWords(subjectRaw);
  const ct         = headers["content-type"] || "text/plain";

  // Extract UniProfile number from To: header — e.g. UP-123456@trips.uniprofile.net
  const upMatch  = toHeader.match(/UP-(\d{6})@/i);
  const upNumber = upMatch ? "UP-" + upMatch[1] : null;

  const text = extractText(ct, bodyBlock, 10000);
  return { upNumber, subject, text };
}

function decodeEncodedWords(str) {
  // RFC 2047 =?charset?encoding?encoded_text?=
  return str.replace(/=\?[^?]+\?[BbQq]\?([^?]*)\?=/g, (_, enc) => {
    try { return Buffer.from(enc, "base64").toString("utf8"); } catch { return enc; }
  });
}

function extractText(contentType, body, maxLen) {
  const ctLower = contentType.toLowerCase();
  const boundaryMatch = contentType.match(/boundary="?([^";\s\r\n]+)"?/i);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp("--" + escapeRegex(boundary) + "(?:--)?\\n?"));
    let plain = "";
    let html  = "";
    for (const part of parts) {
      if (!part.trim() || part.trim() === "--") continue;
      const partHeaderEnd = part.indexOf("\n\n");
      if (partHeaderEnd < 0) continue;
      const partHeaderRaw = part.slice(0, partHeaderEnd).replace(/\r\n/g, "\n").replace(/\n[ \t]+/g, " ");
      const partBody      = part.slice(partHeaderEnd + 2);
      const partCtLine    = (partHeaderRaw.match(/content-type:\s*([^\n]+)/i) || [])[1] || "";
      const partCt        = partCtLine.toLowerCase();
      const partEnc       = ((partHeaderRaw.match(/content-transfer-encoding:\s*([^\n]+)/i) || [])[1] || "").toLowerCase().trim();
      const decoded       = decodeBody(partBody, partEnc);
      if (partCt.startsWith("text/plain") && !plain) plain = decoded;
      else if (partCt.startsWith("text/html")  && !html)  html  = stripHtml(decoded);
      else if (partCt.startsWith("multipart/")) {
        // Nested multipart — recurse
        const nested = extractText(partCtLine, partBody, maxLen);
        if (nested && !plain) plain = nested;
      }
    }
    return (plain || html).slice(0, maxLen);
  }

  // Flat body
  const enc = (contentType.match(/content-transfer-encoding:\s*([^\s;]+)/i) || [])[1] || "";
  const decoded = decodeBody(body, enc.toLowerCase());
  if (ctLower.startsWith("text/html")) return stripHtml(decoded).slice(0, maxLen);
  return decoded.slice(0, maxLen);
}

function decodeBody(body, encoding) {
  try {
    if (encoding === "base64") return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
    if (encoding === "quoted-printable") {
      return body
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
  } catch { /* fall through */ }
  return body;
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ── Claude Haiku extraction ───────────────────────────────────────────────────
async function getAnthropicKey() {
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: "/uniprofile/anthropic/api_key" }));
  return secret.SecretString.trim();
}

async function extractBookings(subject, text, apiKey) {
  const prompt = `Extract all travel bookings from this email. Return ONLY valid JSON, no prose.

Subject: ${subject}
Body:
${text}

Return this exact JSON (null for missing values):
{
  "trips": [
    {
      "trip_name": "descriptive name or null",
      "trip_locator": "PNR or booking reference or null",
      "origin_iata": "3-letter IATA airport code or null",
      "destination_iata": "3-letter IATA airport code or null",
      "departure_date": "YYYY-MM-DD or null",
      "return_date": "YYYY-MM-DD or null",
      "trip_context": "PERSONAL",
      "total_fare": number or null,
      "currency": "3-letter ISO currency code or null",
      "segments": [
        {
          "segment_type": "FLIGHT or TRAIN or CAR or FERRY",
          "segment_order": 1,
          "carrier": "2-letter IATA airline code or carrier name or null",
          "flight_number": "e.g. UA123 or null",
          "origin_iata": "3-letter code or null",
          "destination_iata": "3-letter code or null",
          "departure_datetime": "YYYY-MM-DDTHH:MM or null",
          "arrival_datetime": "YYYY-MM-DDTHH:MM or null",
          "cabin_class": "ECONOMY or PREMIUM_ECONOMY or BUSINESS or FIRST or null",
          "booking_ref": "string or null"
        }
      ]
    }
  ],
  "confidence": "HIGH or MEDIUM or LOW"
}

Rules:
- A round-trip may be ONE trip with two segments, or TWO separate trips — use your judgement based on the email
- Hotel: set origin_iata = destination_iata = nearest airport to the hotel city; no segments needed
- Cruise: origin_iata = embarkation port's nearest airport; no segments needed
- Car rental: origin_iata = pickup location's nearest airport; no segments needed
- If no booking found, return { "trips": [], "confidence": "LOW" }
- IATA codes must be exactly 3 uppercase letters`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Anthropic API " + res.status + ": " + errText.slice(0, 200));
  }

  const data = await res.json();
  const responseText = data.content[0].text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response: " + responseText.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  console.log("Email ingest triggered, records:", (event.Records || []).length);

  for (const record of (event.Records || [])) {
    try {
      const bucket = record.s3.bucket.name;
      const key    = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      console.log("Processing:", bucket + "/" + key);

      // Fetch raw email from S3
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const rawEmail = await obj.Body.transformToString();

      const { upNumber, subject, text } = parseMime(rawEmail);
      console.log("To UP:", upNumber || "(none)", "| Subject:", subject.slice(0, 80));

      if (!upNumber) { console.log("No UP number in To: header — skipping"); continue; }

      // Identify traveler by UniProfile number
      const rows = await sql(
        "SELECT uuid FROM travelers WHERE uniprofile_number=:n",
        [strParam("n", upNumber)]
      );
      if (!rows.length) {
        console.log("No traveler found for:", upNumber, "— ignoring email");
        continue;
      }
      const travelerUuid = rows[0].uuid;

      if (!text.trim()) { console.log("Empty body — skipping"); continue; }

      // Parse with Claude Haiku
      const apiKey = await getAnthropicKey();
      const parsed = await extractBookings(subject, text, apiKey);
      console.log("Extracted:", parsed.trips.length, "trip(s), confidence:", parsed.confidence);

      for (const trip of (parsed.trips || [])) {
        if (!trip.destination_iata) { console.log("Skipping trip — no destination_iata"); continue; }

        // Auto-generate name if missing
        const tripName = trip.trip_name ||
          ((trip.origin_iata || "?") + " → " + trip.destination_iata +
           (trip.departure_date ? "  " + trip.departure_date : ""));

        const tripRows = await sql(
          "INSERT INTO trips (traveler_uuid,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,source_platform,total_fare,currency,notes) " +
          "VALUES (:u,:name,:pnr,:dep,:ret,:orig,:dest,:ctx,'email',:fare,:cur,:notes) RETURNING id",
          [
            uuidParam("u",    travelerUuid),
            strParam ("name", tripName),
            strParam ("pnr",  trip.trip_locator),
            dateParam("dep",  trip.departure_date),
            dateParam("ret",  trip.return_date),
            strParam ("orig", trip.origin_iata),
            strParam ("dest", trip.destination_iata),
            strParam ("ctx",  trip.trip_context || "PERSONAL"),
            numParam ("fare", trip.total_fare),
            strParam ("cur",  trip.currency || "USD"),
            strParam ("notes","Parsed from: " + subject.slice(0, 200)),
          ]
        );

        const tripId = tripRows[0] && tripRows[0].id;
        if (!tripId) { console.log("INSERT returned no id"); continue; }
        console.log("Inserted trip:", tripId, tripName);

        // Insert segments
        let order = 1;
        for (const seg of (trip.segments || [])) {
          if (!seg.origin_iata && !seg.destination_iata) continue;
          await sql(
            "INSERT INTO trip_segments (trip_id,segment_type,segment_order,carrier,flight_number,origin_iata,destination_iata,departure_datetime,arrival_datetime,cabin_class,booking_ref) " +
            "VALUES (:tid,:type,:ord,:car,:flt,:orig,:dest,:dep,:arr,:cab,:ref)",
            [
              strParam("tid",  tripId),
              strParam("type", seg.segment_type  || "FLIGHT"),
              intParam("ord",  seg.segment_order || order),
              strParam("car",  seg.carrier),
              strParam("flt",  seg.flight_number),
              strParam("orig", seg.origin_iata),
              strParam("dest", seg.destination_iata),
              strParam("dep",  seg.departure_datetime),
              strParam("arr",  seg.arrival_datetime),
              strParam("cab",  seg.cabin_class),
              strParam("ref",  seg.booking_ref),
            ]
          );
          order++;
        }
      }
    } catch (e) {
      console.error("Error processing record:", e.message, e.stack && e.stack.slice(0, 400));
    }
  }
};
