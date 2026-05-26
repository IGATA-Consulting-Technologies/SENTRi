import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

function dur(start) {
  const m = Math.round((Date.now() - new Date(start)) / 60000)
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
}

export default function ShiftPage({ gateData, tenantData }) {
  const { guard, gate, tenant, shiftStart, shiftLogId, endShift } = useGuardStore()
  const effectiveGate = gate || gateData || useGuardStore.getState().gate
  const effectiveTenant = tenant || tenantData || useGuardStore.getState().tenant
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
