const fs = require('fs');
const { execSync } = require('child_process');

let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');

// Replace isOnline from store with navigator.onLine directly
admit = admit.replace(
  'const { guard, gate, tenant, isOnline } = useGuardStore()',
  'const { guard, gate, tenant } = useGuardStore()'
);

// Replace synced: isOnline with navigator.onLine
admit = admit.replace(
  'synced: isOnline',
  'synced: navigator.onLine'
);

// Replace if (isOnline) with if (navigator.onLine)
admit = admit.replace(
  'if (isOnline) {',
  'if (navigator.onLine) {'
);

// Fix the offline message display
admit = admit.replace(
  '{!isOnline ? \'Offline — will sync\' : \'Logged\'}',
  '{!navigator.onLine ? \'Offline — will sync\' : \'Logged\'}'
);

fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8');
console.log('isOnline replaced with navigator.onLine');

// Verify changes
const updated = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');
const hasOldIsOnline = updated.includes('isOnline') && !updated.includes('navigator.onLine');
console.log('Has remaining isOnline issues:', hasOldIsOnline);
console.log('navigator.onLine occurrences:', (updated.match(/navigator\.onLine/g) || []).length);

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix sync - use navigator.onLine instead of store isOnline"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
