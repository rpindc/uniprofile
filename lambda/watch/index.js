'use strict';

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SSMClient, GetParameterCommand }          = require('@aws-sdk/client-ssm');
const { SESv2Client, SendEmailCommand }            = require('@aws-sdk/client-sesv2');
const intel = require('./intelligence');

const rds = new RDSDataClient({ region: 'us-east-1' });
const ssm = new SSMClient({ region: 'us-east-1' });
const ses = new SESv2Client({ region: 'us-east-1' });

const DB = {
  resourceArn: process.env.AURORA_CLUSTER_ARN,
  secretArn:   process.env.AURORA_SECRET_ARN,
  database:    process.env.DB_NAME || 'uniprofile'
};

const SHADOW = false;

const PASSPORT_WINDOW_DAYS = 180;
const ECHO_WINDOW_MS = 25 * 60 * 60 * 1000;
const DISPATCH_CAP_PER_24H = 3;

async function sql(query, params) {
  return rds.send(new ExecuteStatementCommand({
    resourceArn: DB.resourceArn,
    secretArn:   DB.secretArn,
    database:    DB.database,
    sql:         query,
    parameters:  params || []
  }));
}

function strParam(name, val) {
  return { name, value: val === null || val === undefined ? { isNull: true } : { stringValue: String(val) } };
}

function intParam(name, val) {
  return { name, value: val === null || val === undefined ? { isNull: true } : { longValue: Number(val) } };
}

function cell(c) {
  if (!c || c.isNull) return null;
  if (c.stringValue  !== undefined) return c.stringValue;
  if (c.longValue    !== undefined) return c.longValue;
  if (c.doubleValue  !== undefined) return c.doubleValue;
  if (c.booleanValue !== undefined) return c.booleanValue;
  return null;
}

function rowToObj(row, cols) {
  var obj = {};
  cols.forEach(function(k, i) { obj[k] = cell(row[i]); });
  return obj;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round(
    (new Date(String(b).slice(0,10) + 'T12:00:00Z') -
     new Date(String(a).slice(0,10) + 'T12:00:00Z')) / 86400000
  );
}

function docSeverity(daysAfterReturn) {
  if (daysAfterReturn === null) return 'unknown';
  var shortage = PASSPORT_WINDOW_DAYS - daysAfterReturn;
  if (shortage <= 0)  return 'ok';
  if (daysAfterReturn <= 30)  return 'urgent';
  if (daysAfterReturn <= 90)  return 'act';
  return 'soon';
}

/* ── SSM kill-switch read (fail-safe: returns true=shadow if SSM unreachable) ── */
async function readDispatchShadow() {
  try {
    var res = await ssm.send(new GetParameterCommand({ Name: '/uniprofile/watch/dispatch_shadow' }));
    return res.Parameter.Value === 'true';
  } catch (e) {
    console.error('[dispatch] SSM read failed:', e.message, '— defaulting to shadow=true (fail safe)');
    return true;
  }
}

/* ── Phase 2: dispatch pending watch_events ────────────────────────────────────
   Reads SSM dispatch_shadow at start AND before each per-traveler send.
   Shadow=true: logs every decision, stamps nothing, sends nothing.
   Shadow=false: atomic stamp-first, then SES send.
────────────────────────────────────────────────────────────────────────────── */
async function dispatchPending() {
  console.log('[dispatch] Phase 2 start');

  /* ── Read kill switch at phase start ── */
  var dispatchShadow = await readDispatchShadow();
  console.log(
    '[dispatch] dispatch_shadow:', dispatchShadow,
    dispatchShadow ? '— LOG ONLY, no stamps or sends' : '— LIVE SENDS enabled'
  );

  /* ── Fetch all pending events; consent is checked per-traveler in loop ── */
  var pendingRes = await sql(
    "SELECT we.id::text, we.traveler_uuid::text, we.signal_key, we.entity_key, " +
    "we.label, we.detail, we.to_severity, we.occurred_at::text, " +
    "t.email, t.email_alerts_enabled, " +
    "COALESCE(ti.legal_first, split_part(t.email, '@', 1)) AS traveler_name " +
    "FROM watch_events we " +
    "JOIN travelers t ON t.uuid = we.traveler_uuid " +
    "LEFT JOIN traveler_identity ti ON ti.traveler_uuid = we.traveler_uuid " +
    "WHERE we.notified_at IS NULL " +
    "  AND we.dismissed_at IS NULL " +
    "  AND we.to_severity IN ('act','urgent') " +
    "ORDER BY we.traveler_uuid, we.occurred_at"
  );
  var pendingCols = ['id','traveler_uuid','signal_key','entity_key','label','detail',
                     'to_severity','occurred_at','email','email_alerts_enabled','traveler_name'];
  var pending = (pendingRes.records || []).map(function(r) { return rowToObj(r, pendingCols); });

  if (!pending.length) {
    console.log('[dispatch] No pending events — Phase 2 done.');
    return { dispatched: 0, sent: 0, capped: 0, skippedConsent: 0 };
  }
  console.log('[dispatch] Pending events:', pending.length);

  /* ── Group by traveler_uuid ── */
  var byTraveler = {};
  pending.forEach(function(r) {
    if (!byTraveler[r.traveler_uuid]) {
      byTraveler[r.traveler_uuid] = {
        email:   r.email,
        name:    r.traveler_name,
        optedIn: r.email_alerts_enabled,
        events:  []
      };
    }
    byTraveler[r.traveler_uuid].events.push(r);
  });

  var totalDispatched = 0, totalSent = 0, totalCapped = 0, totalSkippedConsent = 0;
  var travelerIds = Object.keys(byTraveler);

  for (var ti = 0; ti < travelerIds.length; ti++) {
    var tUuid   = travelerIds[ti];
    var tData   = byTraveler[tUuid];
    var tEmail  = tData.email;
    var tEvents = tData.events;

    /* ── Mid-execution kill check (re-read SSM per traveler) ── */
    var currentShadow = await readDispatchShadow();
    if (currentShadow !== dispatchShadow) {
      console.log(
        '[dispatch] SSM kill: dispatch_shadow flipped to', currentShadow,
        'mid-execution — stopping at traveler', (ti + 1), 'of', travelerIds.length
      );
      break;
    }

    /* ── Consent check ── */
    if (!tData.optedIn) {
      console.log(
        '[dispatch] WOULD-SKIP | email:', tEmail,
        '| alerts:', tEvents.length,
        '| opt-in: false | reason: email_alerts_enabled=FALSE — no email sent'
      );
      totalSkippedConsent++;
      continue;
    }

    /* ── Per-user 24h cap check ── */
    var capRes = await sql(
      "SELECT COUNT(*) AS cnt FROM watch_events " +
      "WHERE traveler_uuid = :u::uuid " +
      "  AND notified_at > NOW() - INTERVAL '24 hours'",
      [strParam('u', tUuid)]
    );
    var capCount = capRes.records && capRes.records[0] ? Number(cell(capRes.records[0][0])) : 0;

    if (capCount >= DISPATCH_CAP_PER_24H) {
      console.log(
        '[dispatch] CAP | email:', tEmail,
        '| cap:', capCount + '/' + DISPATCH_CAP_PER_24H, 'in last 24h — skipping'
      );
      totalCapped++;
      continue;
    }

    var sevSummary = tEvents.map(function(e) {
      return e.to_severity + ':' + (e.label || e.signal_key);
    }).join('; ');

    /* ── Shadow: log full decision, stamp nothing, send nothing ── */
    if (dispatchShadow) {
      console.log(
        '[dispatch] WOULD-SEND | email:', tEmail,
        '| alerts:', tEvents.length,
        '| cap:', capCount + '/' + DISPATCH_CAP_PER_24H,
        '| opt-in: true',
        '| stamp: NOT written',
        '| details:', sevSummary
      );
      totalDispatched++;
      continue;
    }

    /* ── LIVE: atomic stamp-first, then send ── */
    var ids = tEvents.map(function(e) { return e.id; });
    var claimedRes = await sql(
      "UPDATE watch_events SET notified_at = NOW() " +
      "WHERE id = ANY('{" + ids.join(',') + "}'::uuid[]) AND notified_at IS NULL " +
      "RETURNING id::text"
    );
    var claimed = (claimedRes.records || []).map(function(r) { return cell(r[0]); });

    if (!claimed.length) {
      console.log('[dispatch] RACE: 0 rows claimed for', tEmail, '— skipping send (already stamped by another process)');
      continue;
    }

    /* ── Compose and send email ── */
    try {
      var claimedEvents = tEvents.filter(function(e) { return claimed.indexOf(e.id) !== -1; });
      var subjectText = claimedEvents.length === 1
        ? 'Travel alert: ' + (claimedEvents[0].to_severity === 'urgent' ? 'urgent — ' : '')
          + (claimedEvents[0].label || claimedEvents[0].signal_key)
        : claimedEvents.length + ' travel alerts need your attention';

      var cardsHtml = claimedEvents.map(function(e) {
        var sevColor = e.to_severity === 'urgent' ? '#c44d4d' : '#ba7517';
        var sevBg    = e.to_severity === 'urgent' ? '#f4e8e8' : '#f9f1e3';
        var sevLabel = e.to_severity === 'urgent' ? 'URGENT' : 'ACT NOW';
        return '<div style="border:1px solid ' + sevColor + '33;border-radius:8px;padding:16px 18px;margin-bottom:12px;background:#fff">'
          + '<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;'
          + 'padding:2px 8px;border-radius:100px;background:' + sevBg + ';color:' + sevColor + ';margin-bottom:8px">' + sevLabel + '</span>'
          + '<div style="font-size:14px;font-weight:500;color:#111;margin-bottom:4px">'
          + String(e.label || e.signal_key).replace(/</g, '&lt;') + '</div>'
          + (e.detail ? '<div style="font-size:13px;color:#6b7280">' + String(e.detail).replace(/</g, '&lt;') + '</div>' : '')
          + '</div>';
      }).join('');

      /* Unsubscribe token wired in E-live (requires HMAC secret fetch) */
      var unsubUrl = 'https://www.uniprofile.net/me.html';

      var bodyHtml = [
        '<div style="font-family:\'Inter Tight\',-apple-system,sans-serif;background:#faf8f4;padding:32px 20px;max-width:560px;margin:0 auto">',
        '<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#111;margin-bottom:2px">UniProfile</div>',
        '<div style="font-size:11px;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px">Travel alerts</div>',
        '<p style="font-size:14px;color:#4a4a48;margin:0 0 20px">Hi ' + String(tData.name || 'there').replace(/</g, '&lt;') + ', the following items need your attention before your upcoming trip:</p>',
        cardsHtml,
        '<div style="margin-top:24px">',
        '<a href="https://www.uniprofile.net/trips.html" style="display:inline-block;background:#1a1a1a;color:#fff;',
        'text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">View in UniProfile →</a>',
        '</div>',
        '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e4e0;font-size:12px;color:#9ca3af">',
        'You\'re receiving this because UniProfile detected a change affecting your upcoming travel.',
        ' <a href="' + unsubUrl + '" style="color:#9ca3af">Turn off email alerts</a>',
        '</div></div>'
      ].join('');

      var bodyText = 'UniProfile travel alert\n\n'
        + claimedEvents.map(function(e) {
            return '[' + e.to_severity.toUpperCase() + '] ' + (e.label || e.signal_key)
              + (e.detail ? ': ' + e.detail : '');
          }).join('\n')
        + '\n\nView: https://www.uniprofile.net/trips.html'
        + '\nTurn off: ' + unsubUrl;

      await ses.send(new SendEmailCommand({
        FromEmailAddress: 'alerts@uniprofile.net',
        Destination: { ToAddresses: [tEmail] },
        Content: { Simple: {
          Subject: { Data: subjectText, Charset: 'UTF-8' },
          Body: {
            Html: { Data: bodyHtml, Charset: 'UTF-8' },
            Text: { Data: bodyText, Charset: 'UTF-8' }
          }
        }}
      }));

      console.log('[dispatch] SENT | email:', tEmail, '| claimed:', claimed.length, '| cap_after:', (capCount + 1) + '/' + DISPATCH_CAP_PER_24H);
      totalDispatched++;
      totalSent++;
    } catch (sesErr) {
      console.error('[dispatch] SES FAILED | email:', tEmail, '| error:', sesErr.message, '— stamp written, event not re-queued');
    }
  }

  console.log(
    '[dispatch] Phase 2 done',
    '| dispatched:', totalDispatched,
    '| sent:', totalSent,
    '| capped:', totalCapped,
    '| skipped-consent:', totalSkippedConsent,
    '| shadow:', dispatchShadow
  );
  return { dispatched: totalDispatched, sent: totalSent, capped: totalCapped, skippedConsent: totalSkippedConsent };
}

/* ── Decide + write + log one signal ──────────────────────────────────────────
   existing: row from watch_state Map (or undefined for cold-start)
   Returns action taken: 'seed' | 'stable_tick' | 'emit' | 'transition_start' | 'suppress'
────────────────────────────────────────────────────────────────────────────── */
async function processSignal(travelerUuid, signalKey, entityKey, severity, detail, isSuppressed, existing, label) {
  if (isSuppressed) {
    console.log(
      '[watch]   SIGNAL', signalKey,
      '| entity:', entityKey,
      '| severity:', severity,
      '| ACTION: SUPPRESS (echo: modified within last tick window)',
      '| WROTE: nothing'
    );
    return 'suppress';
  }

  if (!existing) {
    var seedDetail = detail || null;
    console.log(
      '[watch]   SIGNAL', signalKey,
      '| entity:', entityKey,
      '| severity:', severity,
      '| ACTION: SEED (cold-start, stable_ticks=0, no emit)',
      SHADOW ? '| WROTE: nothing [shadow]' : '| WROTE: watch_state INSERT'
    );
    if (!SHADOW) {
      await sql(
        'INSERT INTO watch_state (traveler_uuid, signal_key, entity_key, severity, detail, stable_ticks) ' +
        'VALUES (:traveler_uuid::uuid, :signal_key, :entity_key, :severity, :detail, 0)',
        [
          strParam('traveler_uuid', travelerUuid),
          strParam('signal_key',    signalKey),
          strParam('entity_key',    entityKey),
          strParam('severity',      severity),
          strParam('detail',        seedDetail)
        ]
      );
    }
    return 'seed';
  }

  var oldSeverity    = existing.severity;
  var oldStableTicks = existing.stable_ticks;

  if (oldSeverity === severity) {
    var newTicks = oldStableTicks + 1;
    console.log(
      '[watch]   SIGNAL', signalKey,
      '| entity:', entityKey,
      '| severity:', severity,
      '| ACTION: STABLE_TICK (stable_ticks:', oldStableTicks, '→', newTicks, ')',
      SHADOW ? '| WROTE: nothing [shadow]' : '| WROTE: watch_state UPDATE stable_ticks'
    );
    if (!SHADOW) {
      await sql(
        'UPDATE watch_state SET stable_ticks = :ticks, observed_at = NOW() ' +
        'WHERE signal_key = :signal_key AND entity_key = :entity_key',
        [
          intParam('ticks',      newTicks),
          strParam('signal_key', signalKey),
          strParam('entity_key', entityKey)
        ]
      );
    }
    return 'stable_tick';
  }

  var isUrgent   = severity === 'urgent';
  var shouldEmit = isUrgent || oldStableTicks >= 1;

  if (shouldEmit) {
    console.log(
      '[watch]   SIGNAL', signalKey,
      '| entity:', entityKey,
      '| severity:', oldSeverity, '→', severity,
      '| ACTION: EMIT (reason:', isUrgent ? 'urgent-immediate' : 'stable_ticks>=1', ')',
      SHADOW ? '| WROTE: nothing [shadow]' : '| WROTE: watch_events INSERT + watch_state UPDATE'
    );
    if (!SHADOW) {
      await sql(
        'INSERT INTO watch_events (traveler_uuid, signal_key, entity_key, from_severity, to_severity, label, detail) ' +
        'VALUES (:traveler_uuid::uuid, :signal_key, :entity_key, :from_severity, :to_severity, :label, :detail)',
        [
          strParam('traveler_uuid',  travelerUuid),
          strParam('signal_key',     signalKey),
          strParam('entity_key',     entityKey),
          strParam('from_severity',  oldSeverity),
          strParam('to_severity',    severity),
          strParam('label',          label || null),
          strParam('detail',         detail || null)
        ]
      );
      await sql(
        'UPDATE watch_state SET severity = :severity, detail = :detail, stable_ticks = 0, observed_at = NOW() ' +
        'WHERE signal_key = :signal_key AND entity_key = :entity_key',
        [
          strParam('severity',   severity),
          strParam('detail',     detail || null),
          strParam('signal_key', signalKey),
          strParam('entity_key', entityKey)
        ]
      );
    }
    return 'emit';
  }

  console.log(
    '[watch]   SIGNAL', signalKey,
    '| entity:', entityKey,
    '| severity:', oldSeverity, '→', severity,
    '| ACTION: TRANSITION_START (stable_ticks was 0, need >=1 before emit; reset ticks)',
    SHADOW ? '| WROTE: nothing [shadow]' : '| WROTE: watch_state UPDATE severity+stable_ticks=0'
  );
  if (!SHADOW) {
    await sql(
      'UPDATE watch_state SET severity = :severity, detail = :detail, stable_ticks = 0, observed_at = NOW() ' +
      'WHERE signal_key = :signal_key AND entity_key = :entity_key',
      [
        strParam('severity',   severity),
        strParam('detail',     detail || null),
        strParam('signal_key', signalKey),
        strParam('entity_key', entityKey)
      ]
    );
  }
  return 'transition_start';
}

exports.handler = async function(event) {
  var tickStart = new Date().toISOString();
  console.log('[watch] Tick start:', tickStart);
  console.log('[watch] SHADOW:', SHADOW, SHADOW ? '— no writes to watch_state or watch_events' : '— LIVE writes enabled');

  var lastTickMs  = Date.now() - ECHO_WINDOW_MS;
  var lastTickIso = new Date(lastTickMs).toISOString();
  console.log('[watch] Echo suppression window: anything updated after', lastTickIso, 'is suppressed');

  try {
    /* ── STATUS RECOMPUTE ──────────────────────────────────────────────── */
    var STATUS_FORMULA = `CASE
      WHEN departure_date IS NULL                   THEN 'unknown'
      WHEN departure_date > NOW()                   THEN 'upcoming'
      WHEN return_date IS NOT NULL
       AND return_date::date >= NOW()               THEN 'in-progress'
      ELSE                                               'completed'
    END`;

    var preCheck = await sql(
      'SELECT COUNT(*) AS stale FROM trips WHERE status NOT IN (\'absorbed\',\'pending\') AND status != ' + STATUS_FORMULA
    );
    var staleCount = Number(cell(preCheck.records[0][0]) || 0);
    if (staleCount === 0) {
      console.log('[watch] Status recompute: 0 stale rows — skipping UPDATE.');
    } else {
      console.warn('[watch] Status recompute:', staleCount, 'stale row(s) — running UPDATE.');
      await sql('UPDATE trips SET status = ' + STATUS_FORMULA + ' WHERE status NOT IN (\'absorbed\',\'pending\')');
    }

    /* ── FETCH ACTIVE TRIPS ─────────────────────────────────────────────── */
    var tripRes = await sql(
      "SELECT id, traveler_uuid, departure_date::text, return_date::text, status, " +
      "origin_iata, destination_iata, updated_at::text " +
      "FROM trips " +
      "WHERE status IN ('upcoming','in-progress') AND absorbed_into_trip_id IS NULL " +
      "ORDER BY departure_date"
    );
    var tripCols = ['id','traveler_uuid','departure_date','return_date','status','origin_iata','destination_iata','updated_at'];
    var activeTrips = (tripRes.records || []).map(function(r){ return rowToObj(r, tripCols); });

    if (!activeTrips.length) {
      console.log('[watch] No active trips. Tick complete.');
      var dispatchResult0 = await dispatchPending();
      return { tickStart, tickEnd: new Date().toISOString(), statusRecomputeStale: staleCount, shadow: SHADOW, ...dispatchResult0 };
    }

    var tripIds       = activeTrips.map(function(t){ return t.id; });
    var travelerUuids = activeTrips.map(function(t){ return t.traveler_uuid; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    console.log('[watch] Active trips:', activeTrips.length, '| Distinct travelers:', travelerUuids.length);

    /* ── FETCH ALL SEGMENTS ─────────────────────────────────────────────── */
    var segRes = await sql(
      "SELECT id, trip_id, segment_type, segment_order, carrier, flight_number, train_number, " +
      "origin_iata, destination_iata, origin_name, destination_name, " +
      "departure_datetime::text, arrival_datetime::text, duration_minutes, source, updated_at::text " +
      "FROM trip_segments " +
      "WHERE trip_id = ANY('{" + tripIds.join(',') + "}'::uuid[]) " +
      "ORDER BY trip_id, segment_order"
    );
    var segCols = ['id','trip_id','segment_type','segment_order','carrier','flight_number','train_number',
                   'origin_iata','destination_iata','origin_name','destination_name',
                   'departure_datetime','arrival_datetime','duration_minutes','source','updated_at'];
    var segsByTrip = {};
    tripIds.forEach(function(id){ segsByTrip[id] = []; });
    (segRes.records || []).forEach(function(r) {
      var s = rowToObj(r, segCols);
      if (segsByTrip[s.trip_id]) segsByTrip[s.trip_id].push(s);
    });

    /* ── FETCH TRAVEL DOCUMENTS ─────────────────────────────────────────── */
    var docRes = await sql(
      "SELECT id, traveler_uuid, doc_type, expiry_date::text, updated_at::text " +
      "FROM travel_documents " +
      "WHERE traveler_uuid = ANY('{" + travelerUuids.join(',') + "}'::uuid[]) " +
      "AND expiry_date IS NOT NULL " +
      "ORDER BY traveler_uuid, doc_type"
    );
    var docCols = ['id','traveler_uuid','doc_type','expiry_date','updated_at'];
    var allDocs = (docRes.records || []).map(function(r){ return rowToObj(r, docCols); });
    var docsByTraveler = {};
    allDocs.forEach(function(d) {
      if (!docsByTraveler[d.traveler_uuid]) docsByTraveler[d.traveler_uuid] = [];
      docsByTraveler[d.traveler_uuid].push(d);
    });

    console.log('[watch] Total segments fetched across all trips:', (segRes.records||[]).length);
    console.log('[watch] Total docs fetched across all travelers:', allDocs.length);

    /* ── FETCH watch_state for active travelers ─────────────────────────── */
    var wsRes = await sql(
      "SELECT signal_key, entity_key, severity, stable_ticks " +
      "FROM watch_state " +
      "WHERE traveler_uuid = ANY('{" + travelerUuids.join(',') + "}'::uuid[])"
    );
    var wsCols = ['signal_key','entity_key','severity','stable_ticks'];
    var watchStateMap = {};
    (wsRes.records || []).forEach(function(r) {
      var row = rowToObj(r, wsCols);
      watchStateMap[row.signal_key + ':' + row.entity_key] = row;
    });
    console.log('[watch] watch_state rows loaded:', Object.keys(watchStateMap).length);

    /* ── DETECTION LOOP ─────────────────────────────────────────────────── */
    var totalEvaluated = 0, totalSeeded = 0, totalStableTick = 0, totalEmit = 0,
        totalTransitionStart = 0, totalSuppress = 0;

    for (var ti = 0; ti < activeTrips.length; ti++) {
      var trip = activeTrips[ti];
      var segs = segsByTrip[trip.id] || [];

      var tripUpdMs = trip.updated_at ? new Date(trip.updated_at).getTime() : 0;
      var tripTouched = tripUpdMs > lastTickMs;

      var maxFlightSegMs = 0, maxHotelSegMs = 0, maxAnySegMs = 0;
      segs.forEach(function(s) {
        var ms = s.updated_at ? new Date(s.updated_at).getTime() : 0;
        if (ms > maxAnySegMs) maxAnySegMs = ms;
        // Airline-driven updates (source='email_ingest') must NOT suppress — they are the
        // signal we want to detect. Only user/manual edits trigger echo suppression.
        var isUserEdit = s.source !== 'email_ingest';
        if (s.segment_type === 'FLIGHT' && ms > maxFlightSegMs && isUserEdit) maxFlightSegMs = ms;
        if (s.segment_type === 'HOTEL'  && ms > maxHotelSegMs  && isUserEdit) maxHotelSegMs  = ms;
      });
      var flightSegTouched     = maxFlightSegMs > lastTickMs;
      var hotelOrFlightTouched = (maxFlightSegMs > lastTickMs) || (maxHotelSegMs > lastTickMs);

      console.log(
        '[watch] TRIP', trip.id,
        '| status:', trip.status,
        '| dep:', trip.departure_date, '| ret:', trip.return_date,
        '| segments:', segs.length,
        '| seg_types:', segs.map(function(s){ return s.segment_type; }).join(','),
        '| trip.updated_at:', trip.updated_at,
        '| max_flight_seg.updated_at:', maxFlightSegMs ? new Date(maxFlightSegMs).toISOString() : 'none',
        '| max_hotel_seg.updated_at:', maxHotelSegMs ? new Date(maxHotelSegMs).toISOString() : 'none',
        '| echo[trip]:', tripTouched,
        '| echo[flight_segs]:', flightSegTouched,
        '| echo[hotel_or_flight]:', hotelOrFlightTouched
      );

      /* ── trip_status signal ──────────────────────────────────────────── */
      totalEvaluated++;
      var tripStatusSeverity = trip.status === 'unknown' ? 'soon' : 'ok';
      var tripStatusEntityKey = 'trip:' + trip.id;
      var tripStatusExisting = watchStateMap['trip_status:' + tripStatusEntityKey];
      var tsAction = await processSignal(
        trip.traveler_uuid, 'trip_status', tripStatusEntityKey,
        tripStatusSeverity, trip.status, false,
        tripStatusExisting,
        'Trip status: ' + trip.status
      );
      if      (tsAction === 'seed')             totalSeeded++;
      else if (tsAction === 'stable_tick')      totalStableTick++;
      else if (tsAction === 'emit')             totalEmit++;
      else if (tsAction === 'transition_start') totalTransitionStart++;
      else if (tsAction === 'suppress')         totalSuppress++;

      /* ── intelligence for connection + cascade ───────────────────────── */
      var tripObj = {
        segments:         segs,
        departure_date:   trip.departure_date,
        return_date:      trip.return_date,
        origin_iata:      trip.origin_iata,
        destination_iata: trip.destination_iata
      };
      var intelResult = intel.computeTripIntelligence(tripObj, [], []);

      /* ── connection_buffer signals ───────────────────────────────────── */
      var connComponents = intelResult.components.filter(function(c) {
        return c.band && c.band[0] && c.band[0].key === 'connection_buffer';
      });
      if (!connComponents.length) {
        console.log('[watch]   connection_buffer | no connections within 24h window for this trip');
      } else {
        for (var ci = 0; ci < connComponents.length; ci++) {
          var comp    = connComponents[ci];
          var sig     = comp.band[0];
          var connKey = 'trip:' + trip.id + ':conn:' + (comp.fromIata||'?') + '-' + (comp.toIata||'?');
          var connExisting = watchStateMap['connection_buffer:' + connKey];
          totalEvaluated++;
          var connAction = await processSignal(
            trip.traveler_uuid, 'connection_buffer', connKey,
            sig.severity, sig.detail, flightSegTouched,
            connExisting,
            'Connection buffer ' + (comp.fromIata||'?') + '→' + (comp.toIata||'?')
          );
          if      (connAction === 'seed')             totalSeeded++;
          else if (connAction === 'stable_tick')      totalStableTick++;
          else if (connAction === 'emit')             totalEmit++;
          else if (connAction === 'transition_start') totalTransitionStart++;
          else if (connAction === 'suppress')         totalSuppress++;
        }
      }

      /* ── cascade_buffer signals ─────────────────────────────────────── */
      var cascComponents = intelResult.components.filter(function(c) {
        return c.band && c.band[0] && c.band[0].key === 'cascade_buffer';
      });
      if (!cascComponents.length) {
        console.log('[watch]   cascade_buffer | no cascade risk for this trip');
      } else {
        for (var ki = 0; ki < cascComponents.length; ki++) {
          var casc    = cascComponents[ki];
          var csig    = casc.band[0];
          var cascKey = 'trip:' + trip.id + ':cascade:' + (casc.fromIata||'?') + '-' + (casc.toIata||'?');
          var cascExisting = watchStateMap['cascade_buffer:' + cascKey];
          totalEvaluated++;
          var cascAction = await processSignal(
            trip.traveler_uuid, 'cascade_buffer', cascKey,
            csig.severity, csig.detail, hotelOrFlightTouched,
            cascExisting,
            'Cascade buffer ' + (casc.fromIata||'?') + '→' + (casc.toIata||'?')
          );
          if      (cascAction === 'seed')             totalSeeded++;
          else if (cascAction === 'stable_tick')      totalStableTick++;
          else if (cascAction === 'emit')             totalEmit++;
          else if (cascAction === 'transition_start') totalTransitionStart++;
          else if (cascAction === 'suppress')         totalSuppress++;
        }
      }

      /* ── passport_validity signals ──────────────────────────────────── */
      var refDate      = trip.return_date || trip.departure_date;
      var travelerDocs = docsByTraveler[trip.traveler_uuid] || [];

      if (!travelerDocs.length) {
        console.log('[watch]   passport_validity | no documents with expiry date for this traveler');
      } else {
        for (var di = 0; di < travelerDocs.length; di++) {
          var doc = travelerDocs[di];
          totalEvaluated++;
          var daysAfterReturn = daysBetween(refDate, doc.expiry_date);
          var severity        = docSeverity(daysAfterReturn);
          var docEntityKey    = 'trip:' + trip.id + ':doc:' + doc.id;
          var docUpdMs        = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
          var docTouched      = docUpdMs > lastTickMs;
          var docExisting     = watchStateMap['passport_validity:' + docEntityKey];

          var daysFromToday   = daysBetween(new Date().toISOString().slice(0,10), doc.expiry_date);
          var viewSeverity    = docSeverity(daysFromToday);
          var windowNote      = viewSeverity !== severity ? ' [NOTE: expiring_documents today-window would show ' + viewSeverity + ']' : '';

          console.log(
            '[watch]   passport_validity context',
            '| entity:', docEntityKey,
            '| doc_type:', doc.doc_type,
            '| expiry:', doc.expiry_date,
            '| ref_date(trip):', refDate,
            '| days_after_return:', daysAfterReturn,
            '| severity:', severity,
            '| echo_suppress:', docTouched,
            windowNote
          );

          var docAction = await processSignal(
            trip.traveler_uuid, 'passport_validity', docEntityKey,
            severity,
            doc.doc_type + ' expires ' + doc.expiry_date + (daysAfterReturn > 0 ? ' (' + daysAfterReturn + 'd after return)' : daysAfterReturn === 0 ? ' (expires on return date)' : ' (expires before your return — verify entry requirements)'),
            docTouched,
            docExisting,
            doc.doc_type + ' validity for trip ' + trip.id
          );
          if      (docAction === 'seed')             totalSeeded++;
          else if (docAction === 'stable_tick')      totalStableTick++;
          else if (docAction === 'emit')             totalEmit++;
          else if (docAction === 'transition_start') totalTransitionStart++;
          else if (docAction === 'suppress')         totalSuppress++;
        }
      }
    }

    /* ── DETECTION SUMMARY ───────────────────────────────────────────────── */
    console.log(
      '[watch] SUMMARY Phase 1',
      '| active_trips:', activeTrips.length,
      '| total_evaluated:', totalEvaluated,
      '| seeded:', totalSeeded,
      '| stable_tick:', totalStableTick,
      '| emit:', totalEmit,
      '| transition_start:', totalTransitionStart,
      '| suppressed:', totalSuppress,
      '| shadow:', SHADOW
    );

    /* ── Phase 2: dispatch ───────────────────────────────────────────────── */
    var dispatchResult = await dispatchPending();

    var tickEnd = new Date().toISOString();
    console.log('[watch] Tick end:', tickEnd);

    return {
      tickStart, tickEnd,
      statusRecomputeStale: staleCount,
      shadow: SHADOW,
      activeTrips: activeTrips.length,
      totalEvaluated, totalSeeded, totalStableTick, totalEmit, totalTransitionStart, totalSuppress,
      dispatch: dispatchResult
    };

  } catch (err) {
    console.error('[watch] ERROR during tick:', err.message || err);
    if (err.stack) console.error('[watch] Stack:', err.stack);
    throw err;
  }
};
