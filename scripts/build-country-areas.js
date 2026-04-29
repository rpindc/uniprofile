'use strict';
const https = require('https');

const URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

https.get(URL, res => {
  if (res.statusCode !== 200) {
    console.error('HTTP ' + res.statusCode); process.exit(1);
  }
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    let list;
    try { list = JSON.parse(raw); } catch(e) {
      console.error('Not valid JSON'); process.exit(1);
    }
    const map = {};
    list.forEach(function(entry) {
      if (entry.cca2 && entry.area != null) {
        map[entry.cca2] = Math.round(entry.area);
      }
    });
    console.log('const ISO_ALPHA2_TO_AREA = ' + JSON.stringify(map) + ';');
    console.error('// ' + Object.keys(map).length + ' entries');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
