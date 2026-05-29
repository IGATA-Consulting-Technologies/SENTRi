const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Final polish: report, gates UI, PWA, mobile fit, wizard')
console.log('='.repeat(62))

const src = (p) => path.join(process.cwd(), p)

// ─────────────────────────────────────────────────────────────
// 1. ReportTab.jsx — fix flag count misalignment
// Headline uses flagAlerts table, daily uses movements.flag_triggered
// Fix: use data.flags (from movements) everywhere for consistency
// ─────────────────────────────────────────────────────────────
let reportContent = fs.readFileSync(src('src/pages/command/ReportTab.jsx'), 'utf8').replace(/^\uFEFF/, '')

// Fix the stat cards in the report HTML to use data.flags not data.flagTotal
reportContent = reportContent.replace(
  `{ label: 'Flag Hits', value: data.flagTotal, color: data.flagTotal > 0 ? '#c0132a' : '#1a1a2e' },`,
  `{ label: 'Flag Hits', value: data.flags, color: data.flags > 0 ? '#c0132a' : '#1a1a2e' },`
)

// Fix the watchlist section in report HTML
reportContent = reportContent.replace(
  `\${data.flagTotal > 0 ? \`\${section('Watchlist Alerts')}
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:28px;display:flex;align-items:center;gap:20px;">
      <div><div style="font-size:28px;font-weight:700;color:#c0132a;">\${data.flagTotal}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Flag alerts</div></div>
      \${data.flagUnack > 0 ? \`<div><div style="font-size:28px;font-weight:700;color:#c0132a;">\${data.flagUnack}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Unacknowledged</div></div>\` : '<div style="font-size:13px;color:#0e7c3a;font-weight:600;">All acknowledged ├ó┼ôÔÇ£</div>'}
    </div>\` : \`\${section('Watchlist Alerts')}<p style="font-size:13px;color:#6b7280;margin-bottom:28px;">No watchlist alerts in this period.</p>\`}`,
  `\${data.flags > 0 ? \`\${section('Watchlist Alerts')}
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:28px;display:flex;align-items:center;gap:20px;">
      <div><div style="font-size:28px;font-weight:700;color:#c0132a;">\${data.flags}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Flag hits</div></div>
      \${data.flagUnack > 0 ? \`<div><div style="font-size:28px;font-weight:700;color:#c0132a;">\${data.flagUnack}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Unacknowledged</div></div>\` : '<div style="font-size:13px;color:#0e7c3a;font-weight:600;">All acknowledged ✓</div>'}
    </div>\` : \`\${section('Watchlist Alerts')}<p style="font-size:13px;color:#6b7280;margin-bottom:28px;">No watchlist alerts in this period.</p>\`}`
)

// Fix inline report card to use data.flags
reportContent = reportContent.replace(
  `{ key: 'flags', label: 'Flag Hits', value: data.flagTotal, color: 'var(--red)' }`,
  `{ key: 'flags', label: 'Flag Hits', value: data.flags, color: 'var(--red)' }`
)

fs.writeFileSync(src('src/pages/command/ReportTab.jsx'), reportContent, 'utf8')
console.log('✓ ReportTab.jsx — flag counts now consistent between headline and daily breakdown')

// ─────────────────────────────────────────────────────────────
// 2. GatesTab.jsx — proper modern UI + slug with random suffix
// ─────────────────────────────────────────────────────────────
const gatesTabContent = `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

export default function GatesTab() {
  const { tenant } = useAuthStore()
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)
  const [form, setForm] = useState({ name: '', location: '' })
  const [error, setError] = useState('')
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  useEffect(() => { fetchGates() }, [])

  async function fetchGates() {
    setLoading(true)
    const { data } = await supabase.from('gates').select('*')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: true })
    setGates(data || [])
    setLoading(false)
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)
  }

  async function createGate() {
    setError('')
    if (!form.name.trim()) { setError('Gate name is required'); return }
    const slug = slugify(form.name)
    setCreating(true)
    const { error: err } = await supabase.from('gates').insert({
      tenant_id: tenant.id, name: form.name.trim(), slug,
      location: form.location.trim() || null, is_active: true
    })
    setCreating(false)
    if (err) { setError(err.message); return }
    setForm({ name: '', location: '' })
    setShowForm(false)
    fetchGates()
  }

  async function toggleGate(gate) {
    await supabase.from('gates').update({ is_active: !gate.is_active }).eq('id', gate.id)
    fetchGates()
  }

  function copyUrl(gate) {
    const url = appUrl + '/gate/' + tenant.slug + '/' + gate.slug
    navigator.clipboard.writeText(url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: '680px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Gate Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Each gate has a unique URL. Send to guards via WhatsApp.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError('') }}
          style={{ background: showForm ? 'var(--bg-3)' : 'var(--accent)', color: showForm ? 'var(--text-2)' : 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
          {showForm ? 'Cancel' : '+ Add Gate'}
        </button>
      </div>

      {/* Add gate form */}
      {showForm && (
        <div style={{ background: 'var(--bg-1)', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>New Gate</h3>
          {error && <div style={{ background: 'rgba(192,19,42,0.08)', border: '1px solid rgba(192,19,42,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--red)', marginBottom: '12px' }}>{error}</div>}
          <div className="field">
            <label>Gate name *</label>
            <input placeholder="e.g. Main Gate, North Gate" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {form.name && (
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                URL preview: /gate/{tenant.slug}/{form.name.toLowerCase().trim().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-xxxx
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label>Location (optional)</label>
            <input placeholder="e.g. North perimeter, Maryland Road" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <button onClick={createGate} disabled={creating || !form.name.trim()}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 20px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating || !form.name.trim() ? 0.6 : 1 }}>
            {creating ? 'Creating...' : 'Create Gate'}
          </button>
        </div>
      )}

      {/* Gates list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
          Loading gates...
        </div>
      ) : gates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1.5px dashed var(--border-med)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.5" style={{ marginBottom: '12px' }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '16px' }}>No gates configured yet.</p>
          <button onClick={() => setShowForm(true)}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 20px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
            + Add your first gate
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {gates.map(gate => (
            <div key={gate.id} style={{ background: 'var(--bg-1)', border: '1.5px solid', borderColor: gate.is_active ? 'var(--border-med)' : 'var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', opacity: gate.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px' }}>{gate.name}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: gate.is_active ? 'rgba(14,124,58,0.1)' : 'var(--bg-3)', color: gate.is_active ? 'var(--green)' : 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {gate.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {gate.location && <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{gate.location}</div>}
                </div>
                <button onClick={() => toggleGate(gate)}
                  style={{ background: 'none', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '12px', color: gate.is_active ? 'var(--red)' : 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {gate.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '10px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                {appUrl}/gate/{tenant.slug}/{gate.slug}
              </div>
              <button onClick={() => copyUrl(gate)}
                style={{ background: copied === gate.id ? 'var(--green)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}>
                {copied === gate.id ? '✓ Copied!' : 'Copy URL'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
`

fs.writeFileSync(src('src/pages/command/GatesTab.jsx'), gatesTabContent, 'utf8')
console.log('✓ GatesTab.jsx — modern UI, slug with random suffix, clean copy button')

// ─────────────────────────────────────────────────────────────
// 3. PWAInstallPrompt — only show on gate routes, not command/admin
// ─────────────────────────────────────────────────────────────
const pwaContent = `import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const location = useLocation()

  // Only show PWA install prompt on gate routes
  const isGateRoute = location.pathname.startsWith('/gate/')

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (isGateRoute) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isGateRoute])

  useEffect(() => {
    // Hide prompt if user navigates away from gate route
    if (!isGateRoute) setShow(false)
    else if (deferredPrompt) setShow(true)
  }, [isGateRoute, deferredPrompt])

  if (!show || !isGateRoute) return null

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: '#0a2218', color: 'white', borderRadius: '12px',
      padding: '14px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 1000, maxWidth: '340px', width: 'calc(100% - 32px)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', marginBottom: '2px' }}>Install SENTRi Gate</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Add to home screen for offline use</div>
      </div>
      <button onClick={install}
        style={{ background: '#4ade80', color: '#0a2218', border: 'none', borderRadius: '8px', padding: '8px 14px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
        Install
      </button>
      <button onClick={() => setShow(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px', padding: '0', lineHeight: 1 }}>
        ×
      </button>
    </div>
  )
}
`

// Check if PWAInstallPrompt exists
const pwaPath = src('src/components/PWAInstallPrompt.jsx')
if (fs.existsSync(pwaPath)) {
  fs.writeFileSync(pwaPath, pwaContent, 'utf8')
  console.log('✓ PWAInstallPrompt.jsx — now only shows on gate routes, not command/admin')
} else {
  fs.mkdirSync(src('src/components'), { recursive: true })
  fs.writeFileSync(pwaPath, pwaContent, 'utf8')
  console.log('✓ PWAInstallPrompt.jsx — created, gate-only')
}

// ─────────────────────────────────────────────────────────────
// 4. GateApp.jsx — fix mobile screen fit
// Ensure full viewport height with no overflow on mobile
// ─────────────────────────────────────────────────────────────
let gateAppContent = fs.readFileSync(src('src/pages/gate/GateApp.jsx'), 'utf8').replace(/^\uFEFF/, '')

// Fix root container to use dvh (dynamic viewport height) for mobile
gateAppContent = gateAppContent.replace(
  `display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-0)', overflow: 'hidden'`,
  `display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '-webkit-fill-available', background: 'var(--bg-0)', overflow: 'hidden'`
)

// Fix loading screen height too
gateAppContent = gateAppContent.replace(
  `display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-0)', gap: '12px'`,
  `display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-0)', gap: '12px'`
)

fs.writeFileSync(src('src/pages/gate/GateApp.jsx'), gateAppContent, 'utf8')
console.log('✓ GateApp.jsx — uses 100dvh for correct mobile viewport, tabs always visible')

// ─────────────────────────────────────────────────────────────
// 5. index.html — add mobile viewport meta for dvh support
// ─────────────────────────────────────────────────────────────
const indexPath = src('index.html')
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8')
  if (!indexContent.includes('viewport-fit=cover')) {
    indexContent = indexContent.replace(
      `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
      `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
    )
    fs.writeFileSync(indexPath, indexContent, 'utf8')
    console.log('✓ index.html — viewport-fit=cover for iOS safe area support')
  } else {
    console.log('✓ index.html — viewport already configured')
  }
}

// ─────────────────────────────────────────────────────────────
// Git
// ─────────────────────────────────────────────────────────────
try {
  execSync('git add src/pages/command/ReportTab.jsx src/pages/command/GatesTab.jsx src/components/PWAInstallPrompt.jsx src/pages/gate/GateApp.jsx index.html', { stdio: 'inherit' })
  execSync('git commit -m "Polish: report flag alignment, gates UI, gate-only PWA, mobile dvh fix"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nDone. Five fixes in one push:')
console.log('1. Report flag counts consistent between headline and daily breakdown')
console.log('2. Gates tab — modern card UI, proper copy button, random slug suffix')
console.log('3. PWA install prompt — gate routes only, never on command or admin')
console.log('4. Gate PWA — 100dvh so bottom tabs always visible on mobile')
console.log('5. Viewport — viewport-fit=cover for iOS safe area')
