import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getCachedCheckouts, removeCachedCheckout, cacheAdmittedMovement } from '../../lib/offline'
import { useGuardStore } from '../../store'

export default function CheckoutPage() {
  const { tenant, gate } = useGuardStore()
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(null)
  const [checkedOut, setCheckedOut] = useState(null)

  useEffect(() => {
    if (tenant?.id) {
      load()
    } else {
      // Tenant may not be in store yet — poll for it
      const interval = setInterval(() => {
        const t = useGuardStore.getState().tenant
        if (t?.id) { clearInterval(interval); load() }
      }, 200)
      setTimeout(() => clearInterval(interval), 5000)
      return () => clearInterval(interval)
    }
  }, [tenant])

  async function load() {
    setLoading(true)
    if (!navigator.onLine) {
      const cached = await getCachedCheckouts().catch(() => [])
      setEntries(cached.filter(e => !e.exit_time))
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .eq('tenant_id', tenant.id)
      .is('exit_time', null)
      .order('entry_time', { ascending: false })
    if (error) {
      console.error('Checkout load error:', error.message)
      const cached = await getCachedCheckouts().catch(() => [])
      setEntries(cached.filter(e => !e.exit_time))
      setLoading(false)
      return
    }
    setEntries(data || [])
    setLoading(false)
  }

  async function checkout(movement) {
    setCheckingOut(movement.id || movement.cacheKey)
    const exitTime = new Date().toISOString()
    const entryTime = new Date(movement.entry_time)
    const durationMinutes = Math.round((Date.now() - entryTime.getTime()) / 60000)
    const cacheKey = movement.cacheKey || movement.id

    if (!navigator.onLine) {
      // Offline: record exit locally and remove from cache
      const updated = { ...movement, exit_time: exitTime, duration_minutes: durationMinutes }
      await cacheAdmittedMovement(updated).catch(() => {})
      await removeCachedCheckout(cacheKey).catch(() => {})
      setCheckedOut({ ...movement, exit_time: exitTime })
      setEntries(prev => prev.filter(e => (e.id || e.cacheKey) !== (movement.id || movement.cacheKey)))
      setCheckingOut(null)
      setTimeout(() => setCheckedOut(null), 3000)
      return
    }

    const { error } = await supabase
      .from('movements')
      .update({
        exit_time: exitTime,
        duration_minutes: durationMinutes,
        synced: true
      })
      .eq('id', movement.id)

    if (error) {
      console.error('Checkout error:', error.message)
      alert('Checkout failed. Please try again.')
      setCheckingOut(null)
      return
    }

    await removeCachedCheckout(cacheKey).catch(() => {})
    setCheckedOut(movement)
    setEntries(prev => prev.filter(e => e.id !== movement.id))
    setCheckingOut(null)

    // Auto-clear success message after 3 seconds
    setTimeout(() => setCheckedOut(null), 3000)
  }

  function dur(entry) {
    const m = Math.round((Date.now() - new Date(entry)) / 60000)
    return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const filtered = entries.filter(e => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.plate_number?.toLowerCase().includes(q) ||
      e.visitor_name?.toLowerCase().includes(q) ||
      e.destination?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>
          Checkout
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '14px' }}>
          {loading ? 'Loading...' : entries.length + ' currently inside'}
        </p>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search plate or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-1)', fontSize: '14px', color: 'var(--text-0)',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Success banner */}
      {checkedOut && (
        <div style={{
          margin: '0 16px 10px', padding: '12px 14px',
          background: 'rgba(14,124,58,0.08)', border: '1.5px solid rgba(14,124,58,0.25)',
          borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--green)' }}>
              {checkedOut.plate_number || checkedOut.visitor_name} checked out
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
              Duration: {Math.round((new Date(checkedOut.exit_time || Date.now()) - new Date(checkedOut.entry_time)) / 60000)}m
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
            Loading entries...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ marginBottom: '10px', opacity: 0.4 }}>
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h4l3 4v3h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <div style={{ fontSize: '14px' }}>
              {search ? 'No results for "' + search + '"' : 'No vehicles currently inside'}
            </div>
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} style={{
              background: 'var(--bg-1)', border: '1.5px solid var(--border-med)',
              borderRadius: 'var(--radius-lg)', padding: '14px', marginBottom: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              {/* Entry info */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    {entry.plate_number && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: '700',
                        letterSpacing: '0.1em', background: 'var(--bg-3)',
                        padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-med)'
                      }}>
                        {entry.plate_number}
                      </span>
                    )}
                    {entry.visitor_name && (
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-0)' }}>
                        {entry.visitor_name}
                      </span>
                    )}
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600',
                      background: entry.type === 'vehicle' ? 'rgba(37,99,235,0.1)' : 'rgba(14,124,58,0.1)',
                      color: entry.type === 'vehicle' ? 'var(--accent)' : 'var(--green)',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {entry.type}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    {entry.destination} · {entry.purpose}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '14px',
                    fontWeight: '700', color: 'var(--amber)'
                  }}>
                    {dur(entry.entry_time)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                    In at {formatTime(entry.entry_time)}
                  </div>
                </div>
              </div>

              {/* Checkout button */}
              <button
                onClick={() => checkout(entry)}
                disabled={checkingOut === entry.id}
                style={{
                  width: '100%', padding: '10px',
                  background: checkingOut === entry.id ? 'var(--bg-3)' : 'var(--accent)',
                  color: checkingOut === entry.id ? 'var(--text-2)' : 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-display)', fontWeight: '700',
                  fontSize: '13px', cursor: checkingOut === entry.id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.15s', letterSpacing: '0.03em'
                }}
              >
                {checkingOut === entry.id ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px' }} />
                    Checking out...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Check out
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
