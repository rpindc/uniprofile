'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const FILES = [
  {
    url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json',
    out: path.join(__dirname, '../data/world-110m.json'),
    requiredObject: 'land',
    label: 'land-110m'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
    out: path.join(__dirname, '../data/countries-110m.json'),
    requiredObject: 'countries',
    label: 'countries-110m'
  }
];

function fetchAndWrite(file) {
  return new Promise((resolve, reject) => {
    https.get(file.url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(file.label + ': HTTP ' + res.statusCode));
      }
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return reject(new Error(file.label + ': response was not valid JSON'));
        }
        if (parsed.type !== 'Topology' ||
            !parsed.objects ||
            !parsed.objects[file.requiredObject]) {
          return reject(new Error(file.label + ': missing objects.' + file.requiredObject));
        }
        console.log(file.label + ' validated — bbox:', parsed.bbox);
        fs.mkdirSync(path.dirname(file.out), { recursive: true });
        fs.writeFileSync(file.out, raw);
        const kb = (fs.statSync(file.out).size / 1024).toFixed(1);
        console.log('Wrote', file.out, '(' + kb + ' KB)');
        resolve(parsed);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  for (const file of FILES) {
    await fetchAndWrite(file);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
