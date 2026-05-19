// CheckoutPage.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import { getCachedActiveSessions } from '../../lib/offline'

function dur(entry) {
  const m = Math.round((Date.now() - new Date(entry)) / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`
}

export function CheckoutPage({ gateData, tenantData }) {
  const { guard, gate, tenant, isOnline } = useGuardStore()
  const effectiveTenant = tenant || tenantData
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      if (isOnline && effectiveTenant?.id) {
        const { data } = await supabase.from('movements').select('*')
          .eq('tenant_id', effectiveTenant.id).is('exit_time', null)
          .order('entry_time', { ascending: false })
        setSessions(data || [])
      } else {
        setSessions(await getCachedActiveSessions())
      }
    } finally { setLoading(false) }
  }

  const filtered = sessions.filter(s => {
    if (!query) return true
    const q = query.toLowerCase()
    return s.plate_number?.toLowerCase().includes(q) || s.visitor_name?.toLowerCase().includes(q)
  })

  async function confirmCheckout() {
    if (!selected) return
    setConfirming(true)
    const exitTime = new Date().toISOString()
    await supabase.from('movements').update({ exit_time: exitTime }).eq('id', selected.id)
    setDone({ ...selected, exit_time: exitTime })
    setSessions(prev => prev.filter(s => s.id !== selected.id))
    setSelected(null); setConfirming(false)
  }

  if (done) return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Checked out</h2>
      {done.plate_number && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.1em', margin: '8px 0' }}>{done.plate_number}</div>}
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>Duration: {dur(done.entry_time)}</p>
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '320px' }} onClick={() => { setDone(null); load() }}>Another checkout</button>
    </div>
  )

  return (
    <div className="page-content-padded">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Checkout</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>{sessions.length} currently inside</p>
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search plate or name…" value={query} onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: '42px', width: '100%', padding: '12px 14px 12px 42px', background: 'var(--bg-1)', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '15px', fontFamily: 'var(--font-body)', color: 'var(--text-0)' }} />
      </div>
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: '460px', padding: '24px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Confirm checkout</h3>
            {selected.plate_number && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.1em', background: 'var(--bg-2)', padding: '12px', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: '14px' }}>{selected.plate_number}</div>}
            {[{ label: 'Visitor', value: selected.visitor_name || '—' }, { label: 'Destination', value: selected.destination }, { label: 'Time inside', value: dur(selected.entry_time) }].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-2)' }}>{r.label}</span><span style={{ fontWeight: '500' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmCheckout} disabled={confirming}>
                {confirming ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : 'Confirm exit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>Loading...</div>
        : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>{query ? 'No match.' : 'No vehicles inside.'}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(s => (
              <div key={s.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.plate_number && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '17px', letterSpacing: '0.08em', marginBottom: '3px' }}>{s.plate_number}</div>}
                  {s.visitor_name && <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '2px' }}>{s.visitor_name}</div>}
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{s.destination} · {dur(s.entry_time)}</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setSelected(s)}>Exit</button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

export default CheckoutPage
