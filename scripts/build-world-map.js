'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';
const OUT = path.join(__dirname, '../data/world-110m.json');

https.get(URL, res => {
  if (res.statusCode !== 200) {
    console.error('HTTP ' + res.statusCode); process.exit(1);
  }
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Response was not valid JSON');
      process.exit(1);
    }
    if (parsed.type !== 'Topology' ||
        !parsed.objects ||
        !parsed.objects.land) {
      console.error('Response is not a valid topojson land file');
      process.exit(1);
    }
    console.log('Validated topojson — bbox:', parsed.bbox);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, raw);
    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    console.log('Wrote', OUT, '(' + kb + ' KB)');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
