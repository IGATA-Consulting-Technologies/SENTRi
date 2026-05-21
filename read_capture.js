const fs = require('fs');
const admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');
// Extract just the captureOCR function
const match = admit.match(/async function captureOCR\(\)[\s\S]+?(?=\n  async function|\n  function|\n  return)/);
console.log(match ? match[0] : 'not found');
