const fs = require('fs');

const files = [
  'src/App.jsx',
  'src/pages/auth/CommandLogin.jsx',
  'src/pages/command/tabs.jsx',
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log('\n=== ' + f + ' ===');
    console.log(fs.readFileSync(f, 'utf8').substring(0, 500));
  } else {
    console.log('\nMISSING: ' + f);
  }
});
