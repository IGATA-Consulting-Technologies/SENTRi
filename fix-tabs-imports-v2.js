const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Fix tabs.jsx duplicate imports (clean rewrite)')
console.log('='.repeat(55))

const filePath = path.join(process.cwd(), 'src', 'pages', 'command', 'tabs.jsx')

if (!fs.existsSync(filePath)) {
  console.log('✗ File not found:', filePath)
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')

// Find the GatesTab section and remove the 3 duplicate import lines that appear after ReportTab
// Strategy: find the lines between ReportTab's closing and GatesTab's export, strip the imports

const before = content.indexOf("export function GatesTab()")
if (before === -1) {
  console.log('✗ Could not find "export function GatesTab()" in file')
  process.exit(1)
}

// Extract the chunk between last closing brace before GatesTab and the export
const segment = content.slice(0, before)

// Remove any import lines in that segment that are duplicates
// These will be the 3 lines: import { useState, useEffect }, import { supabase }, import { useAuthStore }
const cleaned = segment
  .replace(/^import \{ useState, useEffect \} from 'react'\r?\n/m, '')
  .replace(/^import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase'\r?\n/m, '')
  .replace(/^import \{ useAuthStore \} from '\.\.\/\.\.\/store'\r?\n/m, '')

const newContent = cleaned + content.slice(before)

// Verify
const importCount = (newContent.match(/^import \{ useState/mg) || []).length
console.log('useState import count after fix:', importCount)

if (importCount !== 1) {
  console.log('✗ Still wrong import count. Aborting.')
  process.exit(1)
}

fs.writeFileSync(filePath, newContent, 'utf8')
console.log('✓ File written cleanly')

// Git
try {
  execSync('git add src/pages/command/tabs.jsx', { stdio: 'inherit' })
  execSync('git commit -m "Fix: remove duplicate imports in tabs.jsx GatesTab section"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nDone. Check Netlify in ~60 seconds.')
