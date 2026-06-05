/* ─────────────────────────────────────────────────────────────────────────
   UniProfile — Travel Intelligence Compute Module v0
   Canonical source: uniprofile/intelligence.js
   Lambda:  require('./intelligence')  (copied into lambda/ by deploy step)
   Browser: <script src="/intelligence.js">
   ─────────────────────────────────────────────────────────────────────────
   Signal shape (source-agnostic — same fields the future watch_events table
   will write, so the renderer never needs to change when persistence lands):
     { key, label, severity:'ok'|'soon'|'act'|'urgent',
       detail, source:'computed', mode:'ambient'|'alert' }
   ───────────────────────────────────────────────────────────────────────── */

/* Airport → IANA timezone. Unknown airports degrade silently — never throw. */
var _IATA_TZ = {
  /* North America — East */
  'ATL':'America/New_York','BOS':'America/New_York','BWI':'America/New_York',
  'CLT':'America/New_York','DCA':'America/New_York','EWR':'America/New_York',
  'FLL':'America/New_York','IAD':'America/New_York','JFK':'America/New_York',
  'LGA':'America/New_York','MCO':'America/New_York','MIA':'America/New_York',
  'PHL':'America/New_York','RDU':'America/New_York','TPA':'America/New_York',
  /* North America — Central */
  'AUS':'America/Chicago','BNA':'America/Chicago','DFW':'America/Chicago',
  'IAH':'America/Chicago','MCI':'America/Chicago','MDW':'America/Chicago',
  'MSP':'America/Chicago','MSY':'America/Chicago','ORD':'America/Chicago',
  'SAT':'America/Chicago','STL':'America/Chicago','DTW':'America/Detroit',
  /* North America — Mountain / Pacific */
  'DEN':'America/Denver','SLC':'America/Denver','PHX':'America/Phoenix',
  'HNL':'Pacific/Honolulu',
  'LAX':'America/Los_Angeles','LAS':'America/Los_Angeles','OAK':'America/Los_Angeles',
  'PDX':'America/Los_Angeles','SAN':'America/Los_Angeles','SEA':'America/Los_Angeles',
  'SFO':'America/Los_Angeles','SJC':'America/Los_Angeles',
  /* Canada */
  'YYZ':'America/Toronto','YUL':'America/Toronto','YVR':'America/Vancouver',
  /* Mexico / Caribbean */
  'MEX':'America/Mexico_City','GDL':'America/Mexico_City','CUN':'America/Cancun',
  'MBJ':'America/Jamaica','PUJ':'America/Santo_Domingo',
  /* Central America */
  'LIR':'America/Costa_Rica','SJO':'America/Costa_Rica',
  /* South America */
  'BOG':'America/Bogota','MDE':'America/Bogota','UIO':'America/Guayaquil',
  'LIM':'America/Lima','SCL':'America/Santiago',
  'EZE':'America/Argentina/Buenos_Aires',
  'GRU':'America/Sao_Paulo','GIG':'America/Sao_Paulo',
  /* Europe — West */
  'LHR':'Europe/London','LGW':'Europe/London','DUB':'Europe/Dublin',
  'LIS':'Europe/Lisbon',
  'CDG':'Europe/Paris','NCE':'Europe/Paris',
  'AMS':'Europe/Amsterdam','BRU':'Europe/Brussels',
  'MAD':'Europe/Madrid','BCN':'Europe/Madrid',
  'FCO':'Europe/Rome','MXP':'Europe/Rome',
  'FRA':'Europe/Berlin','MUC':'Europe/Berlin','HAM':'Europe/Berlin',
  'ZRH':'Europe/Zurich','GVA':'Europe/Zurich',
  /* Europe — East / North */
  'VIE':'Europe/Vienna','BUD':'Europe/Budapest',
  'PRG':'Europe/Prague','WAW':'Europe/Warsaw',
  'CPH':'Europe/Copenhagen','ARN':'Europe/Stockholm',
  'OSL':'Europe/Oslo','HEL':'Europe/Helsinki',
  'ATH':'Europe/Athens','IST':'Europe/Istanbul',
  /* Middle East / Africa */
  'DXB':'Asia/Dubai','AUH':'Asia/Dubai','DOH':'Asia/Qatar',
  'KWI':'Asia/Kuwait','AMM':'Asia/Amman',
  'CAI':'Africa/Cairo',
  'NBO':'Africa/Nairobi','ADD':'Africa/Addis_Ababa',
  'JNB':'Africa/Johannesburg','CPT':'Africa/Johannesburg',
  'LOS':'Africa/Lagos','ACC':'Africa/Accra',
  /* South Asia */
  'DEL':'Asia/Kolkata','BOM':'Asia/Kolkata','MAA':'Asia/Kolkata',
  'BLR':'Asia/Kolkata','CCU':'Asia/Kolkata','HYD':'Asia/Kolkata',
  'AMD':'Asia/Kolkata','JAI':'Asia/Kolkata','UDR':'Asia/Kolkata',
  'CMB':'Asia/Colombo','DAC':'Asia/Dhaka','KTM':'Asia/Kathmandu',
  'KHI':'Asia/Karachi','LHE':'Asia/Karachi','ISB':'Asia/Karachi',
  /* SE Asia */
  'SIN':'Asia/Singapore','BKK':'Asia/Bangkok','KUL':'Asia/Kuala_Lumpur',
  'CGK':'Asia/Jakarta','MNL':'Asia/Manila',
  'SGN':'Asia/Ho_Chi_Minh','HAN':'Asia/Bangkok','RGN':'Asia/Rangoon',
  /* East Asia */
  'HKG':'Asia/Hong_Kong','PVG':'Asia/Shanghai','PEK':'Asia/Shanghai',
  'CAN':'Asia/Shanghai','ICN':'Asia/Seoul',
  'NRT':'Asia/Tokyo','KIX':'Asia/Tokyo','HND':'Asia/Tokyo','ITM':'Asia/Tokyo',
  /* Oceania */
  'SYD':'Australia/Sydney','MEL':'Australia/Melbourne','BNE':'Australia/Brisbane',
  'AKL':'Pacific/Auckland'
};

/* Compact IATA→country code — used only for MCT domestic/international classification */
var _IC = {
  'ATL':'US','LAX':'US','ORD':'US','DFW':'US','DEN':'US','JFK':'US','SFO':'US',
  'SEA':'US','LAS':'US','MCO':'US','EWR':'US','MIA':'US','IAH':'US','PHX':'US',
  'BOS':'US','MSP':'US','DTW':'US','PHL':'US','LGA':'US','FLL':'US','BWI':'US',
  'IAD':'US','DCA':'US','MDW':'US','SLC':'US','HNL':'US','SAN':'US','TPA':'US',
  'PDX':'US','SJC':'US','OAK':'US','RDU':'US','BNA':'US','MCI':'US','STL':'US',
  'MSY':'US','SAT':'US','AUS':'US','CLT':'US',
  'LIR':'CR','SJO':'CR','MBJ':'JM','PUJ':'DO',
  'LHR':'GB','LGW':'GB','CDG':'FR','NCE':'FR','AMS':'NL','FRA':'DE','MUC':'DE',
  'HAM':'DE','IST':'TR','MAD':'ES','BCN':'ES','FCO':'IT','MXP':'IT','ZRH':'CH',
  'GVA':'CH','CPH':'DK','ARN':'SE','BRU':'BE','VIE':'AT','DUB':'IE','LIS':'PT',
  'ATH':'GR','HEL':'FI','OSL':'NO','WAW':'PL','PRG':'CZ','BUD':'HU',
  'DXB':'AE','DOH':'QA','AUH':'AE','KWI':'KW','AMM':'JO','CAI':'EG',
  'ADD':'ET','NBO':'KE','JNB':'ZA','CPT':'ZA','LOS':'NG','ACC':'GH',
  'DEL':'IN','BOM':'IN','MAA':'IN','BLR':'IN','CCU':'IN','HYD':'IN',
  'AMD':'IN','JAI':'IN','UDR':'IN','CMB':'LK','DAC':'BD','KTM':'NP',
  'KHI':'PK','LHE':'PK','ISB':'PK','SIN':'SG','BKK':'TH','KUL':'MY',
  'CGK':'ID','MNL':'PH','HKG':'HK','PVG':'CN','PEK':'CN','CAN':'CN',
  'ICN':'KR','NRT':'JP','KIX':'JP','HND':'JP','ITM':'JP','SGN':'VN',
  'HAN':'VN','RGN':'MM','MEL':'AU','SYD':'AU','BNE':'AU','AKL':'NZ',
  'GRU':'BR','GIG':'BR','EZE':'AR','SCL':'CL','LIM':'PE','BOG':'CO',
  'MDE':'CO','UIO':'EC','YYZ':'CA','YVR':'CA','YUL':'CA',
  'MEX':'MX','CUN':'MX','GDL':'MX'
};

/* MCT defaults (minutes) */
var _MCT = { domestic: 45, international: 90, apoc_add: 30 };

/* Passport validity required beyond return date (days) */
var _PASSPORT_WINDOW = 180;

/* ── Internal helpers ── */

function _tzOffsetHours(iata, refDateStr) {
  var tz = _IATA_TZ[iata ? iata.toUpperCase() : ''];
  if (!tz) return null;
  try {
    var d = refDateStr ? new Date(refDateStr.slice(0,10)+'T12:00:00Z') : new Date();
    var utc  = new Date(d.toLocaleString('en-US',{timeZone:'UTC'}));
    var local = new Date(d.toLocaleString('en-US',{timeZone:tz}));
    return Math.round((local - utc) / 1800000) / 2; /* nearest 0.5h */
  } catch(e) { return null; }
}

function _daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  return Math.round(
    (new Date(String(dateB).slice(0,10)+'T12:00:00Z') -
     new Date(String(dateA).slice(0,10)+'T12:00:00Z')) / 86400000
  );
}

function _minutesBetween(dtA, dtB) {
  if (!dtA || !dtB) return null;
  var a = new Date(String(dtA).replace(' ','T'));
  var b = new Date(String(dtB).replace(' ','T'));
  return (isNaN(a)||isNaN(b)) ? null : Math.round((b-a)/60000);
}

function _sig(key, label, severity, detail, mode) {
  return { key:key, label:label, severity:severity, detail:detail, source:'computed', mode:mode };
}

/* ── Signal: connection_buffer ── */

function _computeConnections(segments, memberCount) {
  var results = [];
  var flights = (segments||[])
    .filter(function(s){ return s.segment_type==='FLIGHT'; })
    .sort(function(a,b){ return (a.segment_order||0)-(b.segment_order||0); });

  for (var i=0; i<flights.length-1; i++) {
    var cur=flights[i], nxt=flights[i+1];
    if (!cur.arrival_datetime||!nxt.departure_datetime) continue;
    var gap = _minutesBetween(cur.arrival_datetime, nxt.departure_datetime);
    if (gap===null||gap<0) continue;

    var cDest = (cur.destination_iata||'').toUpperCase();
    var nOrig = (nxt.origin_iata||'').toUpperCase();
    var isDomestic = cDest&&nOrig&&_IC[cDest]&&_IC[nOrig]&&_IC[cDest]===_IC[nOrig];
    var apoc = cDest && nOrig && cDest!==nOrig;
    var mct = (isDomestic?_MCT.domestic:_MCT.international) + (apoc?_MCT.apoc_add:0);

    var severity = gap>=mct+30?'ok' : gap>=mct?'soon' : gap>=mct-15?'act' : 'urgent';
    var groupStr = memberCount>1?' for the group':'';
    var detail, fusionLine=null;

    if (severity==='ok'||severity==='soon') {
      detail = gap+' min connection at '+cDest+' (min '+mct+' min). '
        +(severity==='soon'?'Workable, but watch for delays.':'Comfortable buffer.');
    } else {
      detail = gap+' min at '+cDest+' — MCT is '+mct+' min. '
        +(severity==='urgent'?'Likely insufficient. Plan for disruption.':'May not leave enough time.');
      fusionLine = gap+'-min connection at '+cDest+' — '
        +(severity==='urgent'?'very tight'+groupStr+'. Plan for disruption.':'may be tight'+groupStr+'.');
    }

    results.push({
      fromIata: cur.destination_iata,
      toIata:   nxt.origin_iata,
      signal:   _sig('connection_buffer','Connection '+gap+'min',severity,detail,'alert'),
      fusionLine: fusionLine
    });
  }
  return results;
}

/* ── Signal: passport_validity ── */
/*
 * docs: [{display_name, expiry_date, issuing_country}]
 * detail string never contains the raw expiry date — emits verdict only.
 */
function _computePassportValidity(docs, refDate, memberCount) {
  var signals = [];
  (docs||[]).forEach(function(doc) {
    if (!doc.expiry_date||!refDate) return;
    var daysPost = _daysBetween(refDate, doc.expiry_date); /* positive = valid after refDate */
    if (daysPost===null) return;
    var shortage = _PASSPORT_WINDOW - daysPost;
    if (shortage<=0) return; /* ok — 6+ months valid, no signal */

    var severity = daysPost<=30?'urgent' : daysPost<=90?'act' : 'soon';
    var isSelf = memberCount===0;
    var name = doc.display_name||'Traveler';
    var subject = isSelf?’Your passport’:name+"’s passport";
    var detail = subject+' may not meet the 6-month validity window for this destination. '
      +(isSelf?'Check renewal timelines before departure.':'Coordinate with '+name+' on renewal.');

    signals.push(_sig(
      'passport_validity',
      isSelf?'Passport validity':name+': passport',
      severity, detail, 'alert'
    ));
  });
  return signals;
}

/* ── Signal: traveler_readiness (group only) ── */

function _computeTravelerReadiness(members, passportSignals) {
  if (!members||!members.length) return null;
  var total = members.length;
  var passIssues = passportSignals.filter(function(s){ return s.severity!=='ok'; }).length;
  var dcBlocked = members.filter(function(m){
    return m.doccheck&&(m.doccheck.status==='action_needed'||m.doccheck.result==='conditional');
  }).length;
  var blocked = Math.max(passIssues, dcBlocked);
  var ready = total-blocked;
  var severity = blocked===0?'ok' : blocked===1?'soon' : blocked<total?'act' : 'urgent';
  var label = ready+' of '+total+' ready';
  var detail = blocked===0
    ? 'All '+total+' traveler'+(total===1?'':'s')+' clear for this journey.'
    : blocked+' member'+(blocked===1?'':'s')+' need'+(blocked===1?'s':'')+' attention before travel.';
  return _sig('traveler_readiness', label, severity, detail, 'alert');
}

/* ── Signal: jetlag ── */

function _computeJetlag(trip) {
  var origin = (trip.origin_iata||'').toUpperCase();
  var dest   = (trip.destination_iata||'').toUpperCase();
  if (!origin||!dest||origin===dest) return null;
  var oOff = _tzOffsetHours(origin, trip.departure_date);
  var dOff = _tzOffsetHours(dest,   trip.departure_date);
  if (oOff===null||dOff===null) return null; /* degrade gracefully */
  var shift = Math.abs(dOff-oOff);
  if (shift<1) return null;
  var severity = shift>=6?'act' : shift>=3?'soon' : 'ok';
  var sign = function(n){ return n>=0?'+':''; };
  var detail = origin+' (UTC'+sign(oOff)+oOff+') → '+dest
    +' (UTC'+sign(dOff)+dOff+'). '
    +(shift>=6?'Significant jetlag likely — build in adjustment time.'
              :'Moderate time shift.');
  return _sig('jetlag', '≈'+shift+'h time shift', severity, detail, 'ambient');
}

/* ── Signals: countdowns ── */

function _computeCountdowns(trip) {
  var signals = [];
  if (!trip.departure_date) return signals;
  var today = new Date(); today.setHours(0,0,0,0);
  var dep = new Date(trip.departure_date.slice(0,10)+'T12:00:00Z');
  var diff = Math.round((dep-today)/86400000);
  if (diff>1)       signals.push(_sig('departure_countdown',diff+' days away','ok','Departure in '+diff+' days.','ambient'));
  else if (diff===1) signals.push(_sig('departure_countdown','Tomorrow','soon','Departure is tomorrow.','ambient'));
  else if (diff===0) signals.push(_sig('departure_countdown','Today','act','Departure is today.','ambient'));
  /* check-in window: 0–25 h before departure */
  var hoursAway = (dep.getTime()-Date.now())/3600000;
  if (hoursAway>0&&hoursAway<=25)
    signals.push(_sig('checkin_open','Check-in open','soon','Online check-in is likely available. Complete now to secure your seat.','ambient'));
  return signals;
}

/* ── Main export ── */

function computeTripIntelligence(trip, members, docs) {
  try {
    var memberCount = (members||[]).length;

    /* Umbrella */
    var umbrella = [];
    var jetlag = _computeJetlag(trip);
    if (jetlag) umbrella.push(jetlag);
    _computeCountdowns(trip).forEach(function(s){ umbrella.push(s); });

    /* Connections */
    var connResults = _computeConnections(trip.segments, memberCount);

    /* Passport validity */
    var passportSigs = _computePassportValidity(docs, trip.return_date||trip.departure_date, memberCount);

    /* Traveler readiness (group) or solo passport signal (umbrella) */
    if (memberCount>0) {
      var readiness = _computeTravelerReadiness(members, passportSigs);
      if (readiness) umbrella.push(readiness);
    } else {
      passportSigs.forEach(function(s){ umbrella.push(s); });
    }

    /* Components */
    var components = connResults.map(function(cr,idx){
      return { componentId:'conn_'+idx, type:'FLIGHT',
               fromIata:cr.fromIata, toIata:cr.toIata,
               band:[cr.signal], fusionLine:cr.fusionLine };
    });
    if (memberCount>0) {
      passportSigs.forEach(function(s,idx){
        components.push({ componentId:'pass_'+idx, type:'PASSPORT', band:[s], fusionLine:null });
      });
    }

    /* Alerts: act/urgent from umbrella + components */
    var alerts = [];
    umbrella.forEach(function(s){
      if (s.mode==='alert'&&(s.severity==='act'||s.severity==='urgent')) alerts.push(s);
    });
    components.forEach(function(c){
      c.band.forEach(function(s){
        if (s.severity==='act'||s.severity==='urgent') alerts.push(s);
      });
    });

    return { umbrella:umbrella, components:components, alerts:alerts };
  } catch(e) {
    /* Never break the page — degrade to empty intelligence */
    if (typeof console!=='undefined') console.error('computeTripIntelligence error:',e.message||e);
    return { umbrella:[], components:[], alerts:[] };
  }
}

/* UMD — Node.js (Lambda) and browser globals both work */
if (typeof module!=='undefined'&&module.exports) {
  module.exports = { computeTripIntelligence:computeTripIntelligence, _IATA_TZ:_IATA_TZ };
}
