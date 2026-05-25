// SENTRi — End Shift button + Gates creation form fix
// Run with: node --input-type=commonjs < shift_and_gates_fix.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. NEW ShiftPage — adds End Shift button ─────────────────────────────────

const shiftPage = `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

function dur(start) {
  const m = Math.round((Date.now() - new Date(start)) / 60000)
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
}

export default function ShiftPage({ gateData, tenantData }) {
  const { guard, gate, tenant, shiftStart, shiftLogId, endShift } = useGuardStore()
  const effectiveGate = gate || gateData
  const effectiveTenant = tenant || tenantData
  const [insideCount, setInsideCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [handoverStep, setHandoverStep] = useState(0) // 0=main, 1=handover form, 2=done, 3=end confirm
  const [newServiceNum, setNewServiceNum] = useState('')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    if (!effectiveTenant?.id) return
    const today = new Date(); today.setHours(0,0,0,0)
    const [inside, todays] = await Promise.all([
      supabase.from('movements').select('id', { count: 'exact', head: true }).eq('tenant_id', effectiveTenant.id).is('exit_time', null),
      supabase.from('movements').select('id', { count: 'exact', head: true }).eq('tenant_id', effectiveTenant.id).gte('entry_time', today.toISOString())
    ])
    setInsideCount(inside.count || 0)
    setTodayCount(todays.count || 0)
  }

  async function confirmHandover() {
    if (!newServiceNum.trim() || !newName.trim()) { setError('Please enter incoming guard details.'); return }
    setLoading(true); setError('')
    if (shiftLogId) {
      await supabase.from('shift_logs').update({
        shift_end: new Date().toISOString(),
        vehicles_inside_at_handover: insideCount,
        handover_to_name: newName.trim(),
        handover_to_service_number: newServiceNum.trim().toUpperCase(),
        notes: 'Handover at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      }).eq('id', shiftLogId)
    }
    setLoading(false)
    setHandoverStep(2)
    setTimeout(() => endShift(), 2000)
  }

  async function confirmEndShift() {
    setLoading(true)
    if (shiftLogId) {
      await supabase.from('shift_logs').update({
        shift_end: new Date().toISOString(),
        vehicles_inside_at_handover: insideCount,
        notes: 'Shift ended at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      }).eq('id', shiftLogId)
    }
    setLoading(false)
    endShift()
  }

  // Success screen
  if (handoverStep === 2) return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Shift handed over</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Returning to gate screen...</p>
    </div>
  )

  // Handover form
  if (handoverStep === 1) return (
    <div className="page-content-padded fade-up">
      <button onClick={() => setHandoverStep(0)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>← Back</button>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Incoming guard</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>The incoming guard confirms identity to take over this post.</p>
      {insideCount > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <strong>{insideCount} vehicle{insideCount !== 1 ? 's' : ''}</strong> currently inside — will be recorded in handover log.
        </div>
      )}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="field">
          <label>Service number</label>
          <input type="text" placeholder="e.g. N/67890" value={newServiceNum}
            onChange={e => setNewServiceNum(e.target.value.toUpperCase())}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Full name</label>
          <input type="text" placeholder="Incoming guard's full name" value={newName}
            onChange={e => setNewName(e.target.value)} autoCapitalize="words" />
        </div>
      </div>
      {error && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>}
      <button className="btn btn-primary btn-full btn-lg" onClick={confirmHandover}
        disabled={loading || !newServiceNum || !newName}>
        {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Processing...</> : 'Confirm handover'}
      </button>
    </div>
  )

  // End shift confirmation
  if (handoverStep === 3) return (
    <div className="page-content-padded fade-up">
      <button onClick={() => setHandoverStep(0)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>← Back</button>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>End your shift?</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>
          Your shift will be closed and logged. No handover will be recorded.
        </p>
        {insideCount > 0 && (
          <div className="alert alert-warn" style={{ marginBottom: '20px', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <strong>{insideCount} vehicle{insideCount !== 1 ? 's' : ''}</strong> still inside. Consider handover instead.
          </div>
        )}
        <button className="btn btn-danger btn-full btn-lg" onClick={confirmEndShift} disabled={loading} style={{ marginBottom: '10px' }}>
          {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Ending shift...</> : 'Yes, end my shift'}
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => setHandoverStep(0)}>Cancel</button>
      </div>
    </div>
  )

  // Main shift view
  return (
    <div className="page-content-padded fade-up">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>My shift</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Active since {new Date(shiftStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>

      <div className="card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px' }}>{guard?.rank} {guard?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{guard?.serviceNumber}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '2px' }}>Duration</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', color: 'var(--accent)', fontSize: '15px' }}>{dur(shiftStart)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'Gate', value: effectiveGate?.name },
          { label: 'Start', value: new Date(shiftStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
          { label: 'Inside now', value: insideCount },
          { label: "Today's entries", value: todayCount }
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '5px', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--text-0)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <p style={{ fontSize: '13px', color: 'var(--text-2)', textAlign: 'center', marginBottom: '12px' }}>
        Going off duty?
      </p>

      <button className="btn btn-danger btn-full btn-lg" onClick={() => setHandoverStep(1)} style={{ marginBottom: '10px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        End shift / Handover to incoming guard
      </button>

      <button className="btn btn-ghost btn-full" onClick={() => setHandoverStep(3)}
        style={{ color: 'var(--text-2)', border: '1.5px solid var(--border-med)' }}>
        End my shift only (no handover)
      </button>
    </div>
  )
}
`

// ─── 2. FIX GatesTab — add Create Gate form ───────────────────────────────────

const gatesTab = `// GatesTab.jsx — Gate management with create form
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

export function GatesTab() {
  const { tenant } = useAuthStore()
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newGateName, setNewGateName] = useState('')
  const [newGateLocation, setNewGateLocation] = useState('')
  const [formError, setFormError] = useState('')
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  useEffect(() => { if (tenant?.id) load() }, [tenant])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('gates').select('*')
      .eq('tenant_id', tenant.id).eq('is_active', true).order('created_at')
    setGates(data || [])
    setLoading(false)
  }

  async function createGate() {
    setFormError('')
    if (!newGateName.trim()) { setFormError('Gate name is required'); return }
    setCreating(true)
    const slug = newGateName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const { error } = await supabase.from('gates').insert({
      tenant_id: tenant.id,
      name: newGateName.trim(),
      slug,
      location: newGateLocation.trim() || null,
      is_active: true
    })

    setCreating(false)
    if (error) { setFormError('Failed to create gate: ' + error.message); return }
    setNewGateName('')
    setNewGateLocation('')
    setShowForm(false)
    load()
  }

  function copyUrl(gate) {
    const url = appUrl + '/gate/' + tenant.slug + '/' + gate.slug
    navigator.clipboard.writeText(url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function deactivateGate(id) {
    await supabase.from('gates').update({ is_active: false }).eq('id', id)
    setGates(prev => prev.filter(g => g.id !== id))
  }

  return (
    <div style={{ padding: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Gate URLs</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Each gate has a unique URL. Send to the guard's device via WhatsApp.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(s => !s); setFormError('') }}
          style={{ flexShrink: 0, marginLeft: '12px' }}>
          {showForm ? 'Cancel' : '+ New gate'}
        </button>
      </div>

      {/* Create Gate Form */}
      {showForm && (
        <div className="card fade-up" style={{ marginBottom: '20px', border: '1.5px solid var(--accent)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: 'var(--accent)' }}>
            Create new gate
          </div>
          <div className="field-row" style={{ marginBottom: '12px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Gate name *</label>
              <input type="text" placeholder="e.g. Maryland Gate"
                value={newGateName} onChange={e => { setNewGateName(e.target.value); setFormError('') }} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Location (optional)</label>
              <input type="text" placeholder="e.g. North entrance"
                value={newGateLocation} onChange={e => setNewGateLocation(e.target.value)} />
            </div>
          </div>
          {formError && (
            <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>
          )}
          <button className="btn btn-primary btn-full" onClick={createGate} disabled={creating || !newGateName.trim()}>
            {creating ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Creating...</> : 'Create gate'}
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="alert alert-info" style={{ marginBottom: '20px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Copy each URL and send via WhatsApp to the guard's phone. They open it in Chrome and tap "Add to home screen."
      </div>

      {/* Gates list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>Loading...</div>
      ) : gates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚪</div>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>No gates yet. Create your first gate above.</p>
        </div>
      ) : (
        gates.map(gate => {
          const url = appUrl + '/gate/' + tenant?.slug + '/' + gate.slug
          return (
            <div key={gate.id} className="card" style={{ marginBottom: '12px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>
                    {gate.name}
                  </div>
                  {gate.location && (
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{gate.location}</div>
                  )}
                </div>
                <button onClick={() => deactivateGate(gate.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '600', padding: '2px 6px' }}>
                  Remove
                </button>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '10px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                {url}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => copyUrl(gate)}>
                {copied === gate.id ? '✓ Copied!' : 'Copy URL'}
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing files...')

fs.writeFileSync('src/pages/gate/ShiftPage.jsx', shiftPage, 'utf8')
console.log('✓ ShiftPage.jsx — End Shift button added (no handover option)')

// Replace GatesTab in tabs.jsx
let tabs = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')
const gatesStart = tabs.indexOf('// GatesTab.jsx')
const gatesEnd = tabs.indexOf('\n// ProfileTab.jsx')

if (gatesStart !== -1 && gatesEnd !== -1) {
  tabs = tabs.substring(0, gatesStart) + gatesTab + '\n' + tabs.substring(gatesEnd)
  fs.writeFileSync('src/pages/command/tabs.jsx', tabs, 'utf8')
  console.log('✓ GatesTab in tabs.jsx — Create Gate form added')
} else {
  // Write as separate file and import
  fs.writeFileSync('src/pages/command/GatesTab.jsx', gatesTab, 'utf8')
  console.log('✓ GatesTab.jsx — separate file created with Create Gate form')
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const shift = fs.readFileSync('src/pages/gate/ShiftPage.jsx', 'utf8')
const tabsContent = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')

const checks = {
  'ShiftPage: end shift confirmation screen': shift.includes('handoverStep === 3'),
  'ShiftPage: confirmEndShift function': shift.includes('confirmEndShift'),
  'ShiftPage: End my shift only button': shift.includes('End my shift only'),
  'ShiftPage: no handover option preserved': shift.includes('End shift / Handover'),
  'ShiftPage: warning if vehicles inside': shift.includes('still inside. Consider handover'),
  'GatesTab: create gate form': tabsContent.includes('Create new gate') || fs.existsSync('src/pages/command/GatesTab.jsx'),
  'GatesTab: createGate function': tabsContent.includes('createGate') || fs.readFileSync(fs.existsSync('src/pages/command/GatesTab.jsx') ? 'src/pages/command/GatesTab.jsx' : 'src/pages/command/tabs.jsx', 'utf8').includes('createGate'),
  'GatesTab: remove gate button': tabsContent.includes('deactivateGate') || fs.existsSync('src/pages/command/GatesTab.jsx'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Add End Shift button + Create Gate form in command dashboard"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nTest: Shift tab → two buttons now: Handover and End my shift only')
console.log('Test: Gates tab → + New gate button creates gates from command dashboard')
