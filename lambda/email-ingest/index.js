// UniProfile — Email Ingest Lambda
// Trigger: S3 PutObject on the uniprofile-emails bucket (SES receipt rule drops raw MIME there)
// Flow: raw email → MIME parse → traveler lookup by From: → Claude Haiku extract → trips insert

const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const pdfParse = require("pdf-parse");

const rds = new RDSDataClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3  = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const sm  = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });
const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

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
const tsParam   = (n, v) => {
  if (!v || v === "" || v === "null") return { name: n, value: { isNull: true } };
  // Normalize YYYY-MM-DDTHH:MM → YYYY-MM-DD HH:MM:SS
  const normalized = String(v).replace("T", " ").replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/, "$1:00");
  return { name: n, value: { stringValue: normalized }, typeHint: "TIMESTAMP" };
};
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
  const fromHeader = headers["from"] || "";
  const subjectRaw = headers["subject"] || "";
  const subject    = decodeEncodedWords(subjectRaw);
  const ct         = headers["content-type"] || "text/plain";

  // Extract UniProfile number from To: header — e.g. UP-123456@trips.uniprofile.net
  const upMatch  = toHeader.match(/UP-(\d{6})@/i);
  const upNumber = upMatch ? "UP-" + upMatch[1] : null;

  // Extract plain email from From: header — handles "Name <email>" and bare email
  const fromMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s]+@[^\s]+)/);
  const fromEmail = fromMatch ? fromMatch[1].trim() : null;

  const text = extractText(ct, bodyBlock, 10000);
  const pdfBuffers = extractPdfAttachments(ct, bodyBlock);
  return { upNumber, fromEmail, subject, text, pdfBuffers };
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

function extractPdfAttachments(contentType, body) {
  const buffers = [];
  const boundaryMatch = contentType.match(/boundary="?([^";\s\r\n]+)"?/i);
  if (!boundaryMatch) return buffers;
  const boundary = boundaryMatch[1];
  const parts = body.split(new RegExp("--" + escapeRegex(boundary) + "(?:--)?\\n?"));
  for (const part of parts) {
    if (!part.trim() || part.trim() === "--") continue;
    const partHeaderEnd = part.indexOf("\n\n");
    if (partHeaderEnd < 0) continue;
    const partHeaderRaw = part.slice(0, partHeaderEnd).replace(/\r\n/g, "\n").replace(/\n[ \t]+/g, " ");
    const partBody      = part.slice(partHeaderEnd + 2);
    const ctLine  = (partHeaderRaw.match(/content-type:\s*([^\n]+)/i)  || [])[1] || "";
    const encLine = (partHeaderRaw.match(/content-transfer-encoding:\s*([^\n]+)/i) || [])[1] || "";
    if (ctLine.toLowerCase().includes("application/pdf") || ctLine.toLowerCase().includes("application/octet-stream")) {
      if (encLine.toLowerCase().trim() === "base64") {
        try {
          buffers.push(Buffer.from(partBody.replace(/\s/g, ""), "base64"));
        } catch { /* skip malformed */ }
      }
    }
  }
  return buffers;
}

// ── Claude Haiku extraction ───────────────────────────────────────────────────
async function getAnthropicKey() {
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: "/uniprofile/anthropic/key" }));
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
      "passenger_names": ["full name as it appears in the email, or empty array if not found"],
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

// ── Confirmation email ────────────────────────────────────────────────────────
async function sendConfirmation(toEmail, upNumber, addedTrips, originalSubject) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(ds) {
    if (!ds) return "";
    const d = new Date(ds);
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  let bodyText, bodyHtml;

  if (!addedTrips.length) {
    bodyText = `Hi,\n\nWe received your email "${originalSubject}" but could not find any travel bookings in it.\n\nIf this was a booking confirmation, please forward the original email from your airline, hotel, or travel provider directly to ${upNumber}@trips.uniprofile.net.\n\n— UniProfile TripVault`;
    bodyHtml = `<p>Hi,</p><p>We received your email <em>${originalSubject}</em> but could not find any travel bookings in it.</p><p>If this was a booking confirmation, please forward the original email from your airline, hotel, or travel provider directly to <strong>${upNumber}@trips.uniprofile.net</strong>.</p><p style="color:#888;font-size:12px">— UniProfile TripVault</p>`;
  } else {
    const lines = addedTrips.map(({ tripName, trip }) => {
      const from = trip.origin_iata || "";
      const to   = trip.destination_iata || "";
      const dep  = fmtDate(trip.departure_date);
      const segs = (trip.segments || []);
      const firstSeg = segs[0];
      const flightInfo = firstSeg ? ` · ${firstSeg.flight_number || ""}`.trim() : "";
      return `  • ${from} → ${to}${dep ? "  " + dep : ""}${flightInfo}  (${trip.confidence || "HIGH"} confidence)`;
    });

    bodyText = `Hi,\n\nThe following trip${addedTrips.length > 1 ? "s have" : " has"} been added to your TripVault:\n\n${lines.join("\n")}\n\nView your vault at https://www.uniprofile.net\n\n— UniProfile TripVault`;

    const htmlLines = addedTrips.map(({ tripName, trip }) => {
      const from = trip.origin_iata || "";
      const to   = trip.destination_iata || "";
      const dep  = fmtDate(trip.departure_date);
      const firstSeg = (trip.segments || [])[0];
      const flightInfo = firstSeg ? ` &middot; ${firstSeg.flight_number || ""}` : "";
      return `<li style="padding:4px 0"><strong style="font-family:monospace">${from} &rarr; ${to}</strong>${dep ? "  " + dep : ""}${flightInfo}</li>`;
    }).join("");

    bodyHtml = `<p>Hi,</p><p>The following trip${addedTrips.length > 1 ? "s have" : " has"} been added to your TripVault:</p><ul style="padding-left:20px">${htmlLines}</ul><p><a href="https://www.uniprofile.net" style="color:#2563EB">View your vault →</a></p><p style="color:#888;font-size:12px">— UniProfile TripVault &nbsp;|&nbsp; Forward booking confirmations to ${upNumber}@trips.uniprofile.net</p>`;
  }

  try {
    await ses.send(new SendEmailCommand({
      Source: "TripVault <trips@uniprofile.net>",
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: addedTrips.length ? `TripVault: ${addedTrips.length} trip${addedTrips.length > 1 ? "s" : ""} added` : "TripVault: no booking found" },
        Body: {
          Text: { Data: bodyText },
          Html: { Data: bodyHtml },
        },
      },
    }));
    console.log("Confirmation sent to:", toEmail);
  } catch (e) {
    console.error("Failed to send confirmation:", e.message);
  }
}

// ── Pending verification email ────────────────────────────────────────────────
async function sendVerificationRequest(toEmail, upNumber, pendingTrips, originalSubject) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(ds) {
    if (!ds) return "";
    const d = new Date(ds);
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  const appUrl = process.env.APP_URL || "https://www.uniprofile.net";

  const htmlItems = pendingTrips.map(({ tripName, trip, tripId }) => {
    const from = trip.origin_iata || "";
    const to   = trip.destination_iata || "";
    const dep  = fmtDate(trip.departure_date);
    const firstSeg = (trip.segments || [])[0];
    const flightInfo = firstSeg ? ` · ${firstSeg.flight_number || ""}` : "";
    const confirmUrl = `${appUrl}?verify_trip=${tripId}&action=confirm`;
    const rejectUrl  = `${appUrl}?verify_trip=${tripId}&action=reject`;
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee">
        <strong style="font-family:monospace">${from} → ${to}</strong>${dep ? "  " + dep : ""}${flightInfo}<br>
        <span style="font-size:12px;color:#888">${tripName}</span>
      </td>
      <td style="padding:12px 0 12px 16px;border-bottom:1px solid #eee;white-space:nowrap">
        <a href="${confirmUrl}" style="background:#059669;color:#fff;padding:6px 14px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:500;margin-right:8px">Add to vault</a>
        <a href="${rejectUrl}" style="background:#f3f4f6;color:#374151;padding:6px 14px;border-radius:4px;text-decoration:none;font-size:13px">Not mine</a>
      </td>
    </tr>`;
  }).join("");

  const bodyHtml = `
    <p>Hi,</p>
    <p>We received a booking confirmation email (<em>${originalSubject}</em>) addressed to your TripVault address, but we couldn't verify the passenger name matches your profile.</p>
    <p>Please confirm whether this booking belongs to you:</p>
    <table style="border-collapse:collapse;width:100%;max-width:520px">${htmlItems}</table>
    <p style="color:#888;font-size:12px;margin-top:24px">If you didn't expect this email, click "Not mine" — the booking will be removed. Your TripVault address is <strong>${upNumber}@trips.uniprofile.net</strong>.</p>`;

  const bodyText = pendingTrips.map(({ tripName, trip }) =>
    `${trip.origin_iata || "?"} → ${trip.destination_iata || "?"} ${fmtDate(trip.departure_date)} — ${tripName}`
  ).join("\n");

  try {
    await ses.send(new SendEmailCommand({
      Source: "TripVault <trips@uniprofile.net>",
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: `TripVault: please verify a booking (${originalSubject.slice(0, 50)})` },
        Body: {
          Text: { Data: `Please verify this booking was meant for your profile:\n\n${bodyText}\n\nLog in to confirm or reject: ${appUrl}` },
          Html: { Data: bodyHtml },
        },
      },
    }));
    console.log("Verification request sent to:", toEmail);
  } catch (e) {
    console.error("Failed to send verification request:", e.message);
  }
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

      const { upNumber, fromEmail, subject, text, pdfBuffers } = parseMime(rawEmail);
      console.log("To UP:", upNumber || "(none)", "| Subject:", subject.slice(0, 80));

      // Extract text from any PDF attachments and append to body
      let fullText = text;
      if (pdfBuffers.length) {
        console.log("Found", pdfBuffers.length, "PDF attachment(s) — extracting text");
        for (const buf of pdfBuffers) {
          try {
            const parsed = await pdfParse(buf);
            if (parsed.text && parsed.text.trim()) {
              fullText += "\n\n--- PDF Attachment ---\n" + parsed.text.slice(0, 8000);
              console.log("PDF extracted:", parsed.text.slice(0, 80).replace(/\n/g, " ") + "...");
            }
          } catch (e) {
            console.log("PDF parse failed:", e.message);
          }
        }
      }

      if (!upNumber) { console.log("No UP number in To: header — skipping"); continue; }

      // Identify traveler by UniProfile number — fetch email + name for verification
      const rows = await sql(
        "SELECT t.uuid, t.email, ti.legal_first, ti.legal_last " +
        "FROM travelers t LEFT JOIN traveler_identity ti ON ti.traveler_uuid=t.uuid " +
        "WHERE t.uniprofile_number=:n",
        [strParam("n", upNumber)]
      );
      if (!rows.length) {
        console.log("No traveler found for:", upNumber, "— ignoring email");
        continue;
      }
      const travelerUuid    = rows[0].uuid;
      const travelerEmail   = rows[0].email   || null;
      const travelerFirst   = (rows[0].legal_first || "").toLowerCase().trim();
      const travelerLast    = (rows[0].legal_last  || "").toLowerCase().trim();

      // Determine if sender is the registered user
      const senderIsOwner = fromEmail && travelerEmail &&
        fromEmail.toLowerCase() === travelerEmail.toLowerCase();

      if (!fullText.trim()) { console.log("Empty body and no readable attachments — skipping"); continue; }

      // Parse with Claude Haiku
      const apiKey = await getAnthropicKey();
      const parsed = await extractBookings(subject, fullText, apiKey);
      console.log("Extracted:", parsed.trips.length, "trip(s), confidence:", parsed.confidence);

      const addedTrips = [];

      if (parsed.confidence === "LOW" && !parsed.trips.length) {
        if (fromEmail) await sendConfirmation(fromEmail, upNumber, [], subject);
        continue;
      }

      for (const trip of (parsed.trips || [])) {
        if (!trip.destination_iata) { console.log("Skipping trip — no destination_iata"); continue; }

        // Auto-generate name if missing
        const tripName = trip.trip_name ||
          ((trip.origin_iata || "?") + " → " + trip.destination_iata +
           (trip.departure_date ? "  " + trip.departure_date : ""));

        // Determine trip status: confirmed if sender is owner, or if passenger name matches
        let tripStatus = "upcoming"; // default confirmed
        let needsVerification = false;
        if (!senderIsOwner) {
          const names = (trip.passenger_names || []).map(n => n.toLowerCase());
          const nameMatch = travelerFirst && travelerLast && names.some(n =>
            n.includes(travelerFirst) && n.includes(travelerLast)
          );
          if (!nameMatch) {
            tripStatus = "pending";
            needsVerification = true;
            console.log("Third-party sender, name not matched — marking pending");
          } else {
            console.log("Third-party sender, name matched — auto-confirming");
          }
        }

        const tripRows = await sql(
          "INSERT INTO trips (traveler_uuid,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,source_platform,total_fare,currency,notes,status) " +
          "VALUES (:u,:name,:pnr,:dep,:ret,:orig,:dest,:ctx,'email',:fare,:cur,:notes,:status) " +
          "ON CONFLICT (traveler_uuid,trip_locator) WHERE trip_locator IS NOT NULL DO UPDATE SET trip_name=EXCLUDED.trip_name RETURNING id",
          [
            uuidParam("u",      travelerUuid),
            strParam ("name",   tripName),
            strParam ("pnr",    trip.trip_locator),
            dateParam("dep",    trip.departure_date),
            dateParam("ret",    trip.return_date),
            strParam ("orig",   trip.origin_iata),
            strParam ("dest",   trip.destination_iata),
            strParam ("ctx",    trip.trip_context || "PERSONAL"),
            numParam ("fare",   trip.total_fare),
            strParam ("cur",    trip.currency || "USD"),
            strParam ("notes",  "Parsed from: " + subject.slice(0, 200)),
            strParam ("status", tripStatus),
          ]
        );

        const tripId = tripRows[0] && tripRows[0].id;
        if (!tripId) { console.log("INSERT returned no id"); continue; }
        console.log("Inserted trip:", tripId, tripName, "| status:", tripStatus);
        addedTrips.push({ tripName, trip, tripId, needsVerification });

        // Insert segments
        let order = 1;
        for (const seg of (trip.segments || [])) {
          if (!seg.origin_iata && !seg.destination_iata) continue;
          await sql(
            "INSERT INTO trip_segments (trip_id,segment_type,segment_order,carrier,flight_number,origin_iata,destination_iata,departure_datetime,arrival_datetime,cabin_class,booking_ref) " +
            "VALUES (:tid,:type,:ord,:car,:flt,:orig,:dest,:dep,:arr,:cab,:ref)",
            [
              uuidParam("tid",  tripId),
              strParam("type", seg.segment_type  || "FLIGHT"),
              intParam("ord",  seg.segment_order || order),
              strParam("car",  seg.carrier),
              strParam("flt",  seg.flight_number),
              strParam("orig", seg.origin_iata),
              strParam("dest", seg.destination_iata),
              tsParam ("dep",  seg.departure_datetime),
              tsParam ("arr",  seg.arrival_datetime),
              strParam("cab",  seg.cabin_class),
              strParam("ref",  seg.booking_ref),
            ]
          );
          order++;
        }
      }

      // Confirmed trips → reply to sender
      const confirmed = addedTrips.filter(t => !t.needsVerification);
      if (fromEmail && confirmed.length) {
        await sendConfirmation(fromEmail, upNumber, confirmed, subject);
      }

      // Pending trips → send verification request to the registered email
      const pending = addedTrips.filter(t => t.needsVerification);
      if (travelerEmail && pending.length) {
        await sendVerificationRequest(travelerEmail, upNumber, pending, subject);
      }

    } catch (e) {
      console.error("Error processing record:", e.message, e.stack && e.stack.slice(0, 400));
    }
  }
};
