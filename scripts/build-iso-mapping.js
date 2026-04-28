'use strict';
const https = require('https');

const URL = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/slim-2/slim-2.json';

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
      if (entry['alpha-2'] && entry['country-code']) {
        map[entry['alpha-2']] = entry['country-code'];
      }
    });
    console.log('const ISO_ALPHA2_TO_NUMERIC = ' + JSON.stringify(map) + ';');
    console.error('// ' + Object.keys(map).length + ' entries');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
