const fs = require('fs');

// Read full content of critical files
const store = fs.readFileSync('src/store/index.js', 'utf8');
const tabs = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8');
const commandApp = fs.readFileSync('src/pages/command/CommandApp.jsx', 'utf8');
const appJsx = fs.readFileSync('src/App.jsx', 'utf8');

console.log('=== STORE (full) ===');
console.log(store);

console.log('\n=== APP.JSX (full) ===');
console.log(appJsx);

console.log('\n=== TABS.JSX exports ===');
const tabExports = tabs.match(/^export (function|const|default) .+/gm) || [];
tabExports.forEach(e => console.log(e));

console.log('\n=== TABS.JSX useAuthStore usage ===');
const storeUsage = tabs.match(/.+(useAuthStore|useGuardStore).+/g) || [];
storeUsage.forEach(e => console.log(e));
