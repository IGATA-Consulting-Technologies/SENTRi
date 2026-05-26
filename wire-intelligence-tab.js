const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Wire Intelligence tab into CommandApp')
console.log('='.repeat(50))

const filePath = path.join(process.cwd(), 'src', 'pages', 'command', 'CommandApp.jsx')
let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')

// 1. Add intelligence to TABS array — insert before 'report'
if (content.includes("{ key: 'intelligence'")) {
  console.log('✓ Intelligence tab already in TABS — skipping')
} else {
  content = content.replace(
    "{ key: 'report', label: 'Report' },",
    "{ key: 'intelligence', label: 'Intelligence' },\n  { key: 'report', label: 'Report' },"
  )
  console.log('✓ Added Intelligence to TABS array')
}

// 2. Add case to renderTab switch
if (content.includes("case 'intelligence'")) {
  console.log('✓ Intelligence case already in renderTab — skipping')
} else {
  content = content.replace(
    "case 'report': return <ReportTab />",
    "case 'intelligence': return <IntelligenceTab />\n      case 'report': return <ReportTab />"
  )
  console.log('✓ Added Intelligence case to renderTab switch')
}

// Verify
if (!content.includes("{ key: 'intelligence'") || !content.includes("case 'intelligence'")) {
  console.log('✗ Wiring failed — pattern not matched')
  process.exit(1)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('✓ CommandApp.jsx updated')

// Git
try {
  execSync('git add src/pages/command/CommandApp.jsx', { stdio: 'inherit' })
  execSync('git commit -m "Wire: Intelligence tab into CommandApp nav"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nDone. Intelligence tab will appear between Incidents and Report in the command dashboard.')
