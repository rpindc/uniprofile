'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const tzlookup = require('tz-lookup');

const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUT_PATH = path.join(__dirname, '../data/airports.json');

const KEEP_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error('CSV download failed: HTTP ' + res.statusCode));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve(raw));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSV(raw) {
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
    return obj;
  });
}

async function main() {
  console.log('Downloading OurAirports CSV from', CSV_URL);
  const raw = await fetchCSV(CSV_URL);
  console.log('Download complete. Parsing...');

  const rows = parseCSV(raw);
  console.log('Total rows parsed:', rows.length);

  const filtered = rows.filter(r =>
    KEEP_TYPES.has(r.type) &&
    r.iata_code && r.iata_code.length === 3 &&
    r.latitude_deg && r.longitude_deg
  );
  console.log('Rows after filtering to IATA commercial airports:', filtered.length);

  const db = {};
  let tzNullCount = 0;
  const tzNullList = [];
  const collisions = [];

  filtered.forEach(r => {
    const lat = parseFloat(r.latitude_deg);
    const lng = parseFloat(r.longitude_deg);
    const tz = tzlookup(lat, lng);
    const code = r.iata_code.toUpperCase();

    if (!tz) {
      tzNullCount++;
      tzNullList.push(code + ' (' + lat + ',' + lng + ')');
    }

    if (db[code]) {
      collisions.push({ code, existing: db[code].name, incoming: r.name });
    }

    db[code] = {
      name: r.name,
      city: r.municipality || '',
      country: r.iso_country || '',
      lat: parseFloat(lat.toFixed(4)),
      lng: parseFloat(lng.toFixed(4)),
      elevation_ft: r.elevation_ft ? parseInt(r.elevation_ft, 10) : null,
      timezone: tz || null
    };
  });

  if (tzNullCount > 0) {
    console.error('ERROR: tz-lookup returned null/undefined for', tzNullCount, 'airports:');
    tzNullList.forEach(x => console.error(' ', x));
    process.exit(1);
  }

  if (collisions.length > 0) {
    console.warn('IATA collisions (' + collisions.length + ') — later entry wins:');
    collisions.forEach(c => console.warn('  ' + c.code + ': "' + c.existing + '" replaced by "' + c.incoming + '"'));
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(db));

  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log('Done. Wrote', Object.keys(db).length, 'airports to', OUT_PATH);
  console.log('File size:', sizeKB, 'KB');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
