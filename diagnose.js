const fs = require('fs');

// Check netlify.toml for functions config
const toml = fs.readFileSync('netlify.toml', 'utf8');
console.log('=== netlify.toml ===');
console.log(toml);

// Check if functions directory exists
const hasFunctions = fs.existsSync('netlify/functions');
console.log('\nnetlify/functions exists:', hasFunctions);

// Check vite.config for proxy
const vite = fs.readFileSync('vite.config.js', 'utf8');
console.log('\n=== vite.config.js ===');
console.log(vite);
