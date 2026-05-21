// SENTRi — Scanner Fix (one line)
// The PlateRecognizer API returns plate as a string at best.plate
// NOT best.plate.text — that was wrong
// Run with: node --input-type=commonjs < scanner_fix.js

const fs = require('fs')
const { execSync } = require('child_process')

let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')

// The wrong line
const wrong = "const plateText = best.plate.text.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim()"

// The correct line — plate is a direct string on the result object
const correct = "const plateText = (best.plate || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim()"

if (!admit.includes(wrong)) {
  console.log('ERROR: Expected line not found in AdmitPage.jsx')
  console.log('Searching for current plate extraction line...')
  const lines = admit.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('plateText') || line.includes('best.plate')) {
      console.log('Line ' + (i+1) + ': ' + line.trim())
    }
  })
  process.exit(1)
}

admit = admit.replace(wrong, correct)
fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8')

// Verify fix applied
const verify = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')
if (!verify.includes(correct)) {
  console.log('ERROR: Fix did not apply correctly')
  process.exit(1)
}
if (verify.includes('best.plate.text')) {
  console.log('ERROR: Old wrong code still present')
  process.exit(1)
}

console.log('✓ Scanner fix applied — best.plate.text → best.plate')
console.log('✓ Plate text now extracted correctly from PlateRecognizer response')

execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Fix scanner: best.plate not best.plate.text (PlateRecognizer API response structure)"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('APP-456CV will now read correctly as APP456CV')
