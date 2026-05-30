import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const PAGE_SIZE = 50

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(mins) {
  if (!mins) return '—'
  if (mins < 60) return mins + ' min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h + 'h ' + (m > 0 ? m + 'm' : '')
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function daysAgoStr(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// ── Movement detail modal ────────────────────────────────────────────────────
function MovementDetail({ movement, onClose }) {
  const isInside = !movement.exit_time
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 1000, padding: '0'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-0)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '600px', maxHeight: '85vh',
        overflowY: 'auto', padding: '0 0 32px'
      }} onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '40px', height: '4px', background: 'var(--border-med)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '12px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              {movement.plate_number && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '20px',
                  letterSpacing: '0.08em', color: 'var(--text-0)'
                }}>{movement.plate_number}</span>
              )}
              {movement.visitor_name && (
                <span style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-0)' }}>
                  {movement.visitor_name}
                </span>
              )}
              <span className={'pill ' + (movement.type === 'vehicle' ? 'pill-blue' : 'pill-gray')} style={{ fontSize: '10px' }}>
                {movement.type === 'vehicle' ? 'Vehicle' : 'Pedestrian'}
              </span>
              {movement.flag_triggered && (
                <span className="pill pill-red" style={{ fontSize: '10px' }}>Flagged</span>
              )}
              {isInside && (
                <span className="pill pill-green" style={{ fontSize: '10px' }}>Still inside</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              {movement.gates?.name} · {fmtDate(movement.entry_time)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-2)', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', margin: '0 0 1px' }}>
          {[
            { label: 'Time In', value: fmtTime(movement.entry_time) },
            { label: 'Time Out', value: movement.exit_time ? fmtTime(movement.exit_time) : 'Still inside' },
            { label: 'Duration', value: fmtDuration(movement.duration_minutes) },
          ].map(f => (
            <div key={f.label} style={{ background: 'var(--bg-1)', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>{f.label}</div>
              <div style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-display)', color: f.label === 'Time Out' && isInside ? 'var(--green)' : 'var(--text-0)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ padding: '16px 20px 0' }}>
          {[
            { label: 'Date', value: fmtDate(movement.entry_time) },
            { label: 'Gate', value: movement.gates?.name },
            { label: 'Destination', value: movement.destination },
            { label: 'Purpose', value: movement.purpose },
            { label: 'Occupants', value: movement.occupants > 1 ? movement.occupants + ' people' : null },
            { label: 'ID Number', value: movement.id_number },
            { label: 'Notes', value: movement.notes },
          ].filter(f => f.value).map(f => (
            <div key={f.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '10px 0', borderBottom: '1px solid var(--border)', gap: '16px'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{f.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-0)', textAlign: 'right' }}>{f.value}</span>
            </div>
          ))}

          {movement.flag_triggered && (
            <div style={{
              marginTop: '16px', background: 'rgba(192,19,42,0.06)',
              border: '1px solid rgba(192,19,42,0.2)', borderRadius: '8px',
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0132a" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: '13px', color: '#c0132a', fontWeight: '600' }}>
                This entry triggered a watchlist alert
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Movement card ────────────────────────────────────────────────────────────
function MovementCard({ movement, onClick }) {
  const isInside = !movement.exit_time
  return (
    <div onClick={onClick} className="card" style={{
      marginBottom: '8px', padding: '14px 16px', cursor: 'pointer',
      borderLeft: movement.flag_triggered ? '3px solid var(--red)' : isInside ? '3px solid var(--green)' : '1px solid var(--border)',
      transition: 'box-shadow 0.15s'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {movement.plate_number && (
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px', letterSpacing: '0.06em' }}>
                {movement.plate_number}
              </span>
            )}
            {movement.visitor_name && (
              <span style={{ fontWeight: '600', fontSize: '14px' }}>{movement.visitor_name}</span>
            )}
            {!movement.plate_number && !movement.visitor_name && (
              <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>Unknown</span>
            )}
            {movement.flag_triggered && <span className="pill pill-red" style={{ fontSize: '10px' }}>Flagged</span>}
            {isInside && <span className="pill pill-green" style={{ fontSize: '10px' }}>Inside</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '2px' }}>
            {movement.gates?.name}
            {movement.destination ? ' · ' + movement.destination : ''}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
            {fmtDate(movement.entry_time)} · In {fmtTime(movement.entry_time)}
            {movement.exit_time ? ' · Out ' + fmtTime(movement.exit_time) : ''}
            {movement.duration_minutes ? ' · ' + fmtDuration(movement.duration_minutes) : ''}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '600', fontFamily: 'var(--font-display)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: movement.type === 'vehicle' ? 'var(--accent)' : 'var(--text-2)'
          }}>
            {movement.type === 'vehicle' ? '🚗' : '🚶'} {movement.type}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Main HistoryTab ──────────────────────────────────────────────────────────
export default function HistoryTab() {
  const { tenant } = useAuthStore()

  // Filters
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(daysAgoStr(90))
  const [dateTo, setDateTo] = useState(todayStr())
  const [quickFilter, setQuickFilter] = useState('90d')
  const [typeFilter, setTypeFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState(false)
  const [gateFilter, setGateFilter] = useState('all')

  // Data
  const [movements, setMovements] = useState([])
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(null)

  // Load gates for filter dropdown
  useEffect(() => {
    if (!tenant?.id) return
    supabase.from('gates').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true)
      .then(({ data }) => setGates(data || []))
  }, [tenant?.id])

  const fetchMovements = useCallback(async (reset = true) => {
    if (!tenant?.id) return
    if (reset) setLoading(true)
    else setLoadingMore(true)

    const offset = reset ? 0 : movements.length

    let query = supabase
      .from('movements')
      .select('id,type,plate_number,visitor_name,id_number,destination,purpose,occupants,notes,entry_time,exit_time,duration_minutes,flag_triggered,gate_id,gates(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('entry_time', dateFrom + 'T00:00:00')
      .lte('entry_time', dateTo + 'T23:59:59')
      .order('entry_time', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (typeFilter !== 'all') query = query.eq('type', typeFilter)
    if (flagFilter) query = query.eq('flag_triggered', true)
    if (gateFilter !== 'all') query = query.eq('gate_id', gateFilter)
    if (search.trim()) {
      query = query.or(
        'plate_number.ilike.%' + search.trim() + '%,' +
        'visitor_name.ilike.%' + search.trim() + '%,' +
        'destination.ilike.%' + search.trim() + '%,' +
        'purpose.ilike.%' + search.trim() + '%'
      )
    }

    const { data, count, error } = await query
    if (!error) {
      const results = data || []
      setMovements(reset ? results : prev => [...prev, ...results])
      setTotal(count || 0)
      setHasMore(results.length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [tenant?.id, dateFrom, dateTo, typeFilter, flagFilter, gateFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => fetchMovements(true), search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchMovements])

  function applyQuick(key) {
    setQuickFilter(key)
    const to = todayStr()
    setDateTo(to)
    if (key === 'today') setDateFrom(todayStr())
    else if (key === '7d') setDateFrom(daysAgoStr(7))
    else if (key === '30d') setDateFrom(daysAgoStr(30))
    else if (key === '90d') setDateFrom(daysAgoStr(90))
  }

  const quickBtns = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
  ]

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>History</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          {loading ? 'Loading...' : total.toLocaleString() + ' records in selected period'}
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search plate, name, destination, purpose..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px 10px 36px',
            border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)',
            fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)',
            color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box'
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Quick date filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {quickBtns.map(b => (
          <button key={b.key} onClick={() => applyQuick(b.key)}
            className={'filter-btn' + (quickFilter === b.key ? ' active' : '')}>
            {b.label}
          </button>
        ))}
        <button onClick={() => setQuickFilter('custom')}
          className={'filter-btn' + (quickFilter === 'custom' ? ' active' : '')}>
          Custom range
        </button>
      </div>

      {/* Custom date range */}
      {quickFilter === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border-med)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border-med)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {/* Type + gate + flag filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '7px 10px', border: '1.5px solid var(--border-med)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}>
          <option value="all">All types</option>
          <option value="vehicle">Vehicles only</option>
          <option value="pedestrian">Pedestrians only</option>
        </select>

        {gates.length > 1 && (
          <select value={gateFilter} onChange={e => setGateFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1.5px solid var(--border-med)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}>
            <option value="all">All gates</option>
            {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}

        <button onClick={() => setFlagFilter(f => !f)}
          style={{
            padding: '7px 12px', borderRadius: '8px', border: '1.5px solid',
            borderColor: flagFilter ? 'var(--red)' : 'var(--border-med)',
            background: flagFilter ? 'rgba(192,19,42,0.08)' : 'var(--bg-1)',
            color: flagFilter ? 'var(--red)' : 'var(--text-2)',
            fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
            fontWeight: flagFilter ? '700' : '400'
          }}>
          {flagFilter ? '🚩 Flagged only' : '🚩 Show flagged'}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>Loading records...</div>
      ) : movements.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
          <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>No records found for this search.</p>
          {(search || flagFilter || typeFilter !== 'all' || gateFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setFlagFilter(false); setTypeFilter('all'); setGateFilter('all') }}
              style={{ marginTop: '12px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600' }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {movements.map(m => (
            <MovementCard key={m.id} movement={m} onClick={() => setSelected(m)} />
          ))}

          {hasMore && (
            <button onClick={() => fetchMovements(false)} disabled={loadingMore}
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                background: 'var(--bg-1)', border: '1.5px solid var(--border-med)',
                borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-display)',
                fontWeight: '600', color: 'var(--text-1)', cursor: 'pointer'
              }}>
              {loadingMore ? 'Loading...' : 'Load more records'}
            </button>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && <MovementDetail movement={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
