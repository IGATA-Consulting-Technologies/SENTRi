// SENTRi — Profile Tab Rewrite (email management)
// Run with: node --input-type=commonjs < fix_profile_tab.js

const fs = require('fs')
const { execSync } = require('child_process')

const newProfileTab = `// ProfileTab.jsx
export function ProfileTab() {
  const { tenant, officer } = useAuthStore()
  const [emails, setEmails] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)

  useEffect(() => { if (tenant?.id) loadEmails() }, [tenant])

  async function loadEmails() {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select('report_emails')
      .eq('id', tenant.id)
      .single()
    setEmails(data?.report_emails || [])
    setLoading(false)
  }

  async function addEmail() {
    setAddError('')
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('Please enter a valid email address')
      return
    }
    if (emails.includes(email)) {
      setAddError('This email is already registered')
      return
    }
    setAdding(true)
    const updated = [...emails, email]
    const { error } = await supabase
      .from('tenants')
      .update({ report_emails: updated })
      .eq('id', tenant.id)
    if (error) {
      setAddError('Failed to add email. Try again.')
      setAdding(false)
      return
    }
    // Send welcome email
    try {
      await fetch('/.netlify/functions/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [email],
          subject: 'You have been added to SENTRi Intelligence Alerts — ' + tenant.name,
          html: \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:#1a56db;padding:28px;">
                <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">🛡️ SENTRi</div>
                <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Movement Intelligence Platform</div>
              </div>
              <div style="padding:28px;">
                <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1a1a2e;">You're now on the alert list</h2>
                <p style="font-size:14px;color:#6b7280;margin-bottom:20px;">
                  You have been added as a security intelligence recipient for <strong>\${tenant.name}</strong>.
                  You will now receive flag alerts, incident notifications, and intelligence reports directly to this email.
                </p>
                <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:16px;margin-bottom:24px;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Installation</div>
                  <div style="font-size:15px;font-weight:600;color:#1a1a2e;">\${tenant.name}</div>
                </div>
                <p style="font-size:13px;color:#9ca3af;">If you believe this was added in error, please contact your installation's command officer.</p>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
                <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
                <span style="font-size:11px;color:#9ca3af;">SENTRi Intelligence</span>
              </div>
            </div>
          </body></html>\`
        })
      })
    } catch (e) { console.error('Welcome email error:', e) }

    setEmails(updated)
    setNewEmail('')
    setAdding(false)
  }

  async function removeEmail(email) {
    setRemoving(email)
    const updated = emails.filter(e => e !== email)
    await supabase.from('tenants').update({ report_emails: updated }).eq('id', tenant.id)
    setEmails(updated)
    setRemoving(null)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>Installation profile</h2>

      {/* Installation details */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="section-label" style={{ marginBottom: '14px' }}>Installation details</div>
        {[
          { label: 'Name', value: tenant?.name },
          { label: 'Sector', value: tenant?.sector },
          { label: 'Branch', value: tenant?.branch || '—' },
          { label: 'City', value: tenant?.city || '—' },
          { label: 'State', value: tenant?.state || '—' }
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
            <span style={{ fontWeight: '500' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Alert recipients */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="section-label" style={{ marginBottom: '6px' }}>Security alert recipients</div>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '16px' }}>
          These emails receive flag alerts, incident notifications, and intelligence reports instantly.
          A confirmation email is sent when a new recipient is added.
        </p>

        {/* Add email input */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="email"
            placeholder="Enter email address..."
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setAddError('') }}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
            style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
          />
          <button
            className="btn btn-primary"
            onClick={addEmail}
            disabled={adding || !newEmail.trim()}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {adding ? 'Adding...' : '+ Add'}
          </button>
        </div>

        {addError && (
          <div className="alert alert-danger" style={{ marginBottom: '12px', padding: '10px 12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {addError}
          </div>
        )}

        {/* Email list */}
        {loading ? (
          <div style={{ padding: '12px 0', color: 'var(--text-2)', fontSize: '13px' }}>Loading...</div>
        ) : emails.length === 0 ? (
          <div style={{ padding: '16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '13px', color: 'var(--text-2)' }}>
            No recipients yet. Add an email above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {emails.map(email => (
              <div key={email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-0)', fontWeight: '500' }}>{email}</span>
                </div>
                <button
                  onClick={() => removeEmail(email)}
                  disabled={removing === email}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '600', padding: '4px 8px', borderRadius: '4px' }}
                >
                  {removing === email ? '...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logged in as */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: '14px' }}>Logged in as</div>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{officer?.rank} {officer?.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '2px' }}>{officer?.email}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Role: {officer?.role}</div>
      </div>
    </div>
  )
}`

// Read the full tabs.jsx
let tabs = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')

// Replace just the ProfileTab section
const profileStart = tabs.indexOf('// ProfileTab.jsx\nexport function ProfileTab()')
const profileEnd = tabs.indexOf('\nexport default LiveTab')

if (profileStart === -1) {
  console.log('ProfileTab start not found — trying alternate pattern')
  // Try to find it differently
  const lines = tabs.split('\n')
  lines.forEach((l, i) => {
    if (l.includes('ProfileTab')) console.log(i+1, l)
  })
  process.exit(1)
}

const before = tabs.substring(0, profileStart)
const after = tabs.substring(profileEnd)

const newTabs = before + newProfileTab + after

fs.writeFileSync('src/pages/command/tabs.jsx', newTabs, 'utf8')
console.log('✓ ProfileTab rewritten in tabs.jsx')

// Verify
const written = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')
const checks = {
  'Has addEmail function': written.includes('async function addEmail()'),
  'Has removeEmail function': written.includes('async function removeEmail'),
  'Has email validation': written.includes('test(email)'),
  'Has welcome email on add': written.includes("You're now on the alert list"),
  'Reads fresh from Supabase': written.includes('loadEmails'),
  'Has individual email cards': written.includes('emails.map(email =>'),
  'Has remove button per email': written.includes('Remove'),
  'No comma-separated input': !written.includes('comma-separated'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Profile tab: individual email management with welcome email on add"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nTest: Profile tab → add a new email → check that email for welcome message')
