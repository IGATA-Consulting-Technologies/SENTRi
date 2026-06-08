import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

export default function GateLogPage({ onBack }) {
  const { gate, tenant } = useGuardStore()
  const [period, setPeriod] = useState('today')
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    // Small delay ensures movements inserted just before tab opens are included
    const run = () => {
      const state = useGuardStore.getState()
      const t = tenant || state.tenant
      const g = gate || state.gate
      if (t?.id && g?.id) {
        fetchMovements(t, g)
      } else {
        const interval = setInterval(() => {
          const s = useGuardStore.getState()
          if (s.tenant?.id && s.gate?.id) { clearInterval(interval); fetchMovements(s.tenant, s.gate) }
        }, 200)
        setTimeout(() => clearInterval(interval), 5000)
        return () => clearInterval(interval)
      }
    }
    const timer = setTimeout(run, 300)
    return () => clearTimeout(timer)
  }, [period, tenant, gate])

  // Refetch when tab becomes visible again
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        const s = useGuardStore.getState()
        if (s.tenant?.id && s.gate?.id) fetchMovements(s.tenant, s.gate)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [period])

  async function fetchMovements(tnt, gt) {
    const activeTenant = tnt || tenant || useGuardStore.getState().tenant
    const activeGate = gt || gate || useGuardStore.getState().gate
    if (!activeTenant?.id || !activeGate?.id) return
    setLoading(true)
    let since
    if (period === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0); since = today.toISOString()
    } else {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    const { data } = await supabase.from('movements')
      .select('*, entry_officer:officers!movements_entry_officer_id_fkey(name,rank), exit_officer:officers!movements_exit_officer_id_fkey(name,rank)')
      .eq('tenant_id', activeTenant.id).eq('gate_id', activeGate.id)
      .gte('entry_time', since).order('entry_time', { ascending: false })
    setMovements(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? movements
    : filter === 'inside' ? movements.filter(m => !m.exit_time)
    : filter === 'flagged' ? movements.filter(m => m.flag_triggered)
    : movements.filter(m => m.type === filter)

  const insideCount = movements.filter(m => !m.exit_time).length
  const flagCount = movements.filter(m => m.flag_triggered).length

  return (
    <div className="gate-log-page">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h2>Gate Log</h2>
        <p>{gate?.name}</p>
      </div>
      <div className="period-toggle">
        {[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }].map(p => (
          <button key={p.key} className={'period-btn' + (period === p.key ? ' active' : '')} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="log-summary">
        <div className="log-stat"><span className="log-stat-value">{movements.length}</span><span className="log-stat-label">Total</span></div>
        <div className="log-stat"><span className="log-stat-value green">{insideCount}</span><span className="log-stat-label">Inside</span></div>
        <div className="log-stat"><span className="log-stat-value red">{flagCount}</span><span className="log-stat-label">Flagged</span></div>
      </div>
      <div className="filter-row">
        {['all', 'vehicle', 'pedestrian', 'inside', 'flagged'].map(f => (
          <button key={f} className={'filter-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <div className="loading-state">Loading...</div> : filtered.length === 0 ? (
        <div className="empty-state">No entries for this period.</div>
      ) : (
        <div className="log-list">
          {filtered.map(m => (
            <div key={m.id} className={'log-entry' + (m.flag_triggered ? ' flagged' : '') + (!m.exit_time ? ' inside' : '')}>
              <div className="log-entry-header">
                <div className="log-entry-id">
                  {m.type === 'vehicle' ? 'Vehicle' : 'Person'}: {m.plate_number || m.visitor_name || 'Unknown'}
                  {m.flag_triggered && <span className="flag-indicator"> FLAGGED</span>}
                </div>
                <div className="log-entry-time">
                  {new Date(m.entry_time).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                  {period === 'week' && <span> {new Date(m.entry_time).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' })}</span>}
                </div>
              </div>
              <div className="log-entry-details">
                <span>{m.destination}</span>
                <span> / {m.purpose}</span>
                {m.occupants > 1 && <span> / {m.occupants} pax</span>}
              </div>
              <div className="log-entry-footer">
                <span className={'log-status ' + (!m.exit_time ? 'inside' : 'exited')}>
                  {!m.exit_time ? 'Still inside' : 'Exited ' + m.duration_minutes + 'm'}
                </span>
                {m.entry_officer?.name && <span className="log-officer">{m.entry_officer.rank} {m.entry_officer.name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
