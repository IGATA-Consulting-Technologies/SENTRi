const fs = require('fs');
const { execSync } = require('child_process');

// Read CommandLogin to see what it expects
const login = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8');
console.log('=== CommandLogin.jsx ===');
console.log(login);
