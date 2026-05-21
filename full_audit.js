const fs = require('fs');

const files = [
  'src/App.jsx',
  'src/main.jsx',
  'src/store/index.js',
  'src/pages/auth/CommandLogin.jsx',
  'src/pages/command/CommandApp.jsx',
  'src/pages/command/tabs.jsx',
  'src/pages/command/GatesTab.jsx',
  'src/pages/command/IncidentsTab.jsx',
  'src/pages/command/ReportTab.jsx',
  'src/pages/gate/GateApp.jsx',
  'src/pages/gate/ShiftStart.jsx',
  'src/pages/gate/AdmitPage.jsx',
  'src/pages/gate/CheckoutPage.jsx',
  'src/pages/gate/ShiftPage.jsx',
  'src/pages/gate/GateLogPage.jsx',
  'src/pages/gate/ReportIncidentPage.jsx',
  'src/pages/admin/AdminApp.jsx',
  'src/lib/supabase.js',
  'src/lib/offline.js',
  'package.json',
  'vite.config.js',
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    // Get all imports
    const imports = content.match(/^import .+ from .+/gm) || [];
    console.log('\nOK: ' + f + ' (' + content.length + ' chars)');
    imports.forEach(i => console.log('  ' + i));
  } else {
    console.log('\nMISSING: ' + f);
  }
});
