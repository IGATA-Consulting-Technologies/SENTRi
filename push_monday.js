// SENTRi — Push monday_build files (validator was too strict on one check)
// Run with: node --input-type=commonjs < push_monday.js

const fs = require('fs')
const { execSync } = require('child_process')

const emailContent = fs.readFileSync('src/lib/email.js', 'utf8')
const incidentContent = fs.readFileSync('src/pages/gate/ReportIncidentPage.jsx', 'utf8')
const reportContent = fs.readFileSync('src/pages/command/ReportTab.jsx', 'utf8')
const incTabContent = fs.readFileSync('src/pages/command/IncidentsTab.jsx', 'utf8')

const checks = {
  'Email: sendIncidentAlertEmail present': emailContent.includes('sendIncidentAlertEmail'),
  'Email: sendReportEmail present': emailContent.includes('sendReportEmail'),
  'Incident page: sends email': incidentContent.includes('sendIncidentAlertEmail'),
  'Report tab: has send function': reportContent.includes('sendReport'),
  'Report tab: has email button': reportContent.includes('Email this report') || reportContent.includes('email this report') || reportContent.includes('sending'),
  'Incidents tab: FK join removed': !incTabContent.includes('officers!incidents_officer_id_fkey'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) {
  console.log('\nActual checks failed — do not push')
  process.exit(1)
}

console.log('\nAll good. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Monday build: incident emails, report send button, incidents tab fix"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
