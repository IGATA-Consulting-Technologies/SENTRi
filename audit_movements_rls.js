const fs = require('fs');

// Read offline.js to understand the sync mechanism
const offline = fs.readFileSync('src/lib/offline.js', 'utf8');
console.log('=== offline.js ===');
console.log(offline);

// Read the movements insert in AdmitPage
const admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');
const submitFn = admit.match(/async function submit\(\)[^}]+(?:\{[^}]*\}[^}]*)*\}/s);
console.log('\n=== submit function ===');
console.log(submitFn ? submitFn[0].substring(0, 1000) : 'not found');
