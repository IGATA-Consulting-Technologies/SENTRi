// SENTRi — Fix ReportTab send button and push
// Run with: node --input-type=commonjs < fix_report_button.js

const fs = require('fs')
const { execSync } = require('child_process')

let report = fs.readFileSync('src/pages/command/ReportTab.jsx', 'utf8')

// Show what's currently around the filter row area
const lines = report.split('\n')
console.log('=== Current ReportTab structure (first 30 lines) ===')
lines.slice(0, 30).forEach((l, i) => console.log(i+1, l))

// Check if sendReport function exists
console.log('\nHas sendReport function:', report.includes('async function sendReport'))
console.log('Has sending state:', report.includes('setSending'))
console.log('Has email button text:', report.includes('Email this report'))
console.log('Has 📧:', report.includes('📧'))

// If button is missing, add it properly
if (!report.includes('Email this report') && !report.includes('📧')) {
  console.log('\nButton missing — adding now...')
  
  // Add sending state to existing useState declarations
  if (!report.includes('const [sending, setSending]')) {
    report = report.replace(
      "const [loading, setLoading] = useState(true)",
      "const [loading, setLoading] = useState(true)\n  const [sending, setSending] = useState(false)\n  const [sent, setSent] = useState(false)"
    )
  }

  // Add sendReport function before the return
  if (!report.includes('async function sendReport')) {
    report = report.replace(
      '  return (',
      `  async function sendReport() {
    setSending(true)
    try {
      const { data: tenantData } = await supabase.from('tenants').select('name, report_emails').eq('id', tenant.id).single()
      if (!tenantData?.report_emails?.length) {
        alert('No report emails configured. Add them in the Profile tab.')
        setSending(false); return
      }
      const periodLabel = PERIODS.find(p => p.key === period)?.label || period
      await sendReportEmail({ tenantName: tenantData.name, period: periodLabel, data, reportEmails: tenantData.report_emails })
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (e) { console.error('Send report error:', e) }
    setSending(false)
  }

  return (`
    )
  }

  // Add button after the period filter buttons
  report = report.replace(
    '{loading ? (',
    `{data && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={sendReport}
            disabled={sending || !data}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {sending ? 'Sending...' : sent ? '✓ Sent!' : '📧 Email this report'}
          </button>
        </div>
      )}
      {loading ? (`
  )
  
  console.log('Button added')
} else {
  console.log('Button already present')
}

// Add import if missing
if (!report.includes("from '../../lib/email'")) {
  report = "import { sendReportEmail } from '../../lib/email'\n" + report
  console.log('Import added')
}

fs.writeFileSync('src/pages/command/ReportTab.jsx', report, 'utf8')

// Verify
const written = fs.readFileSync('src/pages/command/ReportTab.jsx', 'utf8')
console.log('\n=== Verification ===')
console.log('Has sendReport:', written.includes('sendReport'))
console.log('Has email button:', written.includes('Email this report'))
console.log('Has import:', written.includes("from '../../lib/email'"))

if (!written.includes('Email this report') || !written.includes('sendReport')) {
  console.log('\nFix failed — check file manually')
  process.exit(1)
}

console.log('\nPushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Monday build: incident emails, report email button, incidents tab fix"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
