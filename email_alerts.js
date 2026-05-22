// SENTRi — Email Alert System
// Builds: Netlify function for sending flag alert emails via Resend
// Run with: node --input-type=commonjs < email_alerts.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── NETLIFY FUNCTION: send-alert-email ───────────────────────────────────────

const emailFunction = `const https = require('https')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { to, subject, html } = JSON.parse(event.body)

    if (!to || !subject || !html) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const payload = JSON.stringify({
      from: 'SENTRi Alerts <alerts@igataconsulting.tech>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_FF99D5ZP_PRQZmErHp9hjUeSYYK5cEcM6',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
          catch (e) { resolve({ status: res.statusCode, body: data }) }
        })
      })

      req.on('error', reject)
      req.write(payload)
      req.end()
    })

    if (result.status === 200 || result.status === 201) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, id: result.body.id })
      }
    } else {
      console.error('Resend error:', result.body)
      return {
        statusCode: result.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: result.body })
      }
    }

  } catch (error) {
    console.error('Email function error:', error.message)
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    }
  }
}
`

// ─── EMAIL HELPER: src/lib/email.js ───────────────────────────────────────────

const emailHelper = `// SENTRi Email Helper
// Sends alert emails via the Netlify proxy function

export async function sendFlagAlertEmail({ tenantName, gateName, plate, visitorName, destination, purpose, reportEmails }) {
  if (!reportEmails || reportEmails.length === 0) return

  const identifier = plate || visitorName || 'Unknown'
  const subject = '🚨 SENTRi Flag Alert — ' + identifier + ' at ' + gateName

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background:#c0132a;padding:24px 28px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:20px;">🛡️</span>
            </div>
            <div>
              <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">SENTRi</div>
              <div style="color:rgba(255,255,255,0.8);font-size:12px;">Flag Alert — Immediate Attention Required</div>
            </div>
          </div>
        </div>

        <!-- Alert body -->
        <div style="padding:28px;">
          <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">
            Watchlisted Entry Detected
          </h2>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
            A flagged vehicle or person has been admitted at <strong>\${gateName}</strong>.
          </p>

          <!-- Details card -->
          <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:24px;">
            \${plate ? \`
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Plate Number</div>
              <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#1a1a2e;">\${plate}</div>
            </div>\` : ''}
            \${visitorName ? \`
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Visitor Name</div>
              <div style="font-size:16px;font-weight:600;color:#1a1a2e;">\${visitorName}</div>
            </div>\` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px;">
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Destination</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">\${destination || '—'}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Purpose</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">\${purpose || '—'}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Installation</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">\${tenantName}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Gate</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">\${gateName}</div>
              </div>
            </div>
          </div>

          <!-- Time -->
          <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
            Detected at <strong>\${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
          </p>

          <!-- CTA -->
          <a href="https://sentri-igata.netlify.app/command" 
             style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.03em;">
            View on Command Dashboard →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
          <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
        </div>
      </div>
    </body>
    </html>
  \`

  try {
    const response = await fetch('/.netlify/functions/send-alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: reportEmails, subject, html })
    })
    const result = await response.json()
    if (result.success) {
      console.log('Flag alert email sent to:', reportEmails)
    } else {
      console.error('Email send failed:', result.error)
    }
  } catch (e) {
    console.error('Email helper error:', e)
  }
}
`

// ─── UPDATE ADMITPAGE to send email after flagged admission ───────────────────

const admitPagePatch = `
  // Send email alert if entry was flagged
  async function checkAndAlertIfFlagged(movementId) {
    try {
      const { data: movement } = await supabase
        .from('movements')
        .select('flag_triggered, plate_number, visitor_name, destination, purpose')
        .eq('id', movementId)
        .single()

      if (movement?.flag_triggered) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('name, report_emails')
          .eq('id', effectiveTenant.id)
          .single()

        if (tenantData?.report_emails?.length > 0) {
          await sendFlagAlertEmail({
            tenantName: tenantData.name,
            gateName: effectiveGate?.name || 'Unknown Gate',
            plate: movement.plate_number,
            visitorName: movement.visitor_name,
            destination: movement.destination,
            purpose: movement.purpose,
            reportEmails: tenantData.report_emails
          })
        }
      }
    } catch (e) {
      console.error('Flag check error:', e)
    }
  }
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing files...')

// 1. Netlify function
fs.mkdirSync('netlify/functions', { recursive: true })
fs.writeFileSync('netlify/functions/send-alert-email.js', emailFunction, 'utf8')
console.log('✓ netlify/functions/send-alert-email.js')

// 2. Email helper
fs.mkdirSync('src/lib', { recursive: true })
fs.writeFileSync('src/lib/email.js', emailHelper, 'utf8')
console.log('✓ src/lib/email.js')

// 3. Update AdmitPage to import and call email helper
let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')

// Add import if not already there
if (!admit.includes("from '../../lib/email'")) {
  admit = admit.replace(
    "import { queueMovement } from '../../lib/offline'",
    "import { queueMovement } from '../../lib/offline'\nimport { sendFlagAlertEmail } from '../../lib/email'"
  )
  console.log('✓ Added email import to AdmitPage')
}

// Add the checkAndAlertIfFlagged function before the submit function
if (!admit.includes('checkAndAlertIfFlagged')) {
  admit = admit.replace(
    '  async function submit() {',
    admitPagePatch + '\n  async function submit() {'
  )
  console.log('✓ Added checkAndAlertIfFlagged function')
}

// Call it after successful insert
if (!admit.includes('checkAndAlertIfFlagged(data.id)')) {
  admit = admit.replace(
    'const { data, error } = await supabase.from(\'movements\').insert(movement).select().single()\n        if (error) throw error\n        setSubmitted(data || movement)',
    'const { data, error } = await supabase.from(\'movements\').insert(movement).select().single()\n        if (error) throw error\n        setSubmitted(data || movement)\n        if (data?.id) checkAndAlertIfFlagged(data.id)'
  )
  console.log('✓ Wired checkAndAlertIfFlagged after successful insert')
}

fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const fnContent = fs.readFileSync('netlify/functions/send-alert-email.js', 'utf8')
const emailContent = fs.readFileSync('src/lib/email.js', 'utf8')
const admitContent = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')

const checks = {
  'Email function uses https': fnContent.includes('https.request'),
  'Email function uses Resend API': fnContent.includes('api.resend.com'),
  'Email from igataconsulting.tech': fnContent.includes('igataconsulting.tech'),
  'Email helper has HTML template': emailContent.includes('Watchlisted Entry Detected'),
  'Email helper has IGATA footer': emailContent.includes('IGATA Technologies'),
  'Email helper calls netlify function': emailContent.includes('send-alert-email'),
  'AdmitPage imports email helper': admitContent.includes("from '../../lib/email'"),
  'AdmitPage calls flag check': admitContent.includes('checkAndAlertIfFlagged'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) {
  console.log('\nSome checks failed — not pushing')
  process.exit(1)
}

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Add email alerts via Resend for flag triggers"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nOnce deployed, admit a flagged vehicle and check igataprojects@gmail.com for the alert email.')
