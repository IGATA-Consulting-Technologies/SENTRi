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
  if (mins < 60) return mins + 'm'
  const h = Math.floor(mins / 60)
  if (h < 24) return h + 'h' + (mins % 60 > 0 ? ' ' + (mins % 60) + 'm' : '')
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'd ' + (h % 24) + 'h'
  const wk = Math.floor(d / 7)
  if (wk < 5) return wk + 'wk ' + (d % 7) + 'd'
  const mo = Math.floor(d / 30)
  return mo + 'mo ' + (d % 30) + 'd'
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function daysAgoStr(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 660)
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 660)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isDesktop
}

function OfficerBadge({ officer, label }) {
  if (!officer) return null
  const name = [officer.rank, officer.name].filter(Boolean).join(' ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 0', borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-display)', marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-0)' }}>{name}</div>
      </div>
    </div>
  )
}

function MovementDetail({ movement, onClose }) {
  const isInside = !movement.exit_time
  const isDesktop = useIsDesktop()

  const overlayStyle = {
    position: 'fixed', inset: 0,
    background: isDesktop ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: isDesktop ? 'center' : 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: isDesktop ? '24px' : '0'
  }

  const cardStyle = {
    background: 'var(--bg-0)',
    borderRadius: isDesktop ? '16px' : '20px 20px 0 0',
    width: '100%',
    maxWidth: isDesktop ? '520px' : '100%',
    maxHeight: isDesktop ? '85vh' : '92vh',
    overflowY: 'auto',
    paddingBottom: '28px',
    boxShadow: isDesktop
      ? '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)'
      : '0 -4px 40px rgba(0,0,0,0.12)'
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Drag handle — mobile only */}
        {!isDesktop && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border-med)', borderRadius: '2px' }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: isDesktop ? '20px 24px 16px' : '14px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
          position: 'sticky', top: 0, background: 'var(--bg-0)', zIndex: 1
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
              {movement.plate_number && (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: isDesktop ? '22px' : '20px', letterSpacing: '0.08em', color: 'var(--text-0)' }}>
                  {movement.plate_number}
                </span>
              )}
              {movement.visitor_name && (
                <span style={{ fontWeight: '700', fontSize: isDesktop ? '20px' : '18px', color: 'var(--text-0)' }}>
                  {movement.visitor_name}
                </span>
              )}
              {!movement.plate_number && !movement.visitor_name && (
                <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-2)' }}>Unknown</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span className={'pill ' + (movement.type === 'vehicle' ? 'pill-blue' : 'pill-gray')} style={{ fontSize: '11px' }}>
                {movement.type === 'vehicle' ? 'Vehicle' : 'Pedestrian'}
              </span>
              {movement.flag_triggered && <span className="pill pill-red" style={{ fontSize: '11px' }}>Flagged</span>}
              {isInside && <span className="pill pill-green" style={{ fontSize: '11px' }}>Still inside</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              {movement.gates?.name} · {fmtDate(movement.entry_time)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-2)', border: 'none', borderRadius: '50%',
            width: '34px', height: '34px', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Time stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
          {[
            { label: 'Time In', value: fmtTime(movement.entry_time), highlight: false },
            { label: 'Time Out', value: movement.exit_time ? fmtTime(movement.exit_time) : 'Still inside', highlight: isInside },
            { label: 'Duration', value: fmtDuration(movement.duration_minutes), highlight: false },
          ].map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 16px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>{f.label}</div>
              <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)', color: f.highlight ? 'var(--green)' : 'var(--text-0)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Detail rows */}
        <div style={{ padding: '0 ' + (isDesktop ? '24px' : '20px') }}>

          {/* Officer row */}
          {movement.officer_name && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-display)', marginBottom: '1px' }}>Admitted by</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-0)' }}>{movement.officer_name}</div>
              </div>
            </div>
          )}

          {/* Field rows */}
          {[
            { label: 'Gate', value: movement.gates?.name },
            { label: 'Date', value: fmtDate(movement.entry_time) },
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
              <span style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, paddingTop: '1px' }}>{f.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-0)', textAlign: 'right' }}>{f.value}</span>
            </div>
          ))}

          {/* Flag alert banner */}
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

function MovementCard({ movement, onClick }) {
  const isInside = !movement.exit_time
  const officerName = movement.officer_name || null

  return (
    <div onClick={onClick} className="card" style={{
      marginBottom: '8px', padding: '14px 16px', cursor: 'pointer',
      borderLeft: movement.flag_triggered ? '3px solid var(--red)' : isInside ? '3px solid var(--green)' : '1px solid var(--border)',
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
            {movement.gates?.name}{movement.destination ? ' · ' + movement.destination : ''}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: officerName ? '2px' : 0 }}>
            {fmtDate(movement.entry_time)} · In {fmtTime(movement.entry_time)}
            {movement.exit_time ? ' · Out ' + fmtTime(movement.exit_time) : ''}
            {movement.duration_minutes ? ' · ' + fmtDuration(movement.duration_minutes) : ''}
          </div>
          {officerName && (
            <div style={{ fontSize: '11px', color: 'var(--text-2)', fontStyle: 'italic' }}>
              Admitted by {officerName}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '600', fontFamily: 'var(--font-display)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: movement.type === 'vehicle' ? 'var(--accent)' : 'var(--text-2)'
          }}>
            {movement.type === 'vehicle' ? '🚗' : '🚶'} {movement.type}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--border-med)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function HistoryTab() {
  const { tenant } = useAuthStore()

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(daysAgoStr(90))
  const [dateTo, setDateTo] = useState(todayStr())
  const [quickFilter, setQuickFilter] = useState('90d')
  const [typeFilter, setTypeFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState(false)
  const [gateFilter, setGateFilter] = useState('all')
  const [movements, setMovements] = useState([])
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(null)

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
      .select(
        'id,type,plate_number,visitor_name,id_number,destination,purpose,occupants,notes,' +
        'entry_time,exit_time,duration_minutes,flag_triggered,gate_id,' +
        'officer_name,gates(name)',
        { count: 'exact' }
      )
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
    if (error) console.error('History fetch error:', error.message)
    const results = data || []
    setMovements(reset ? results : prev => [...prev, ...results])
    setTotal(count || 0)
    setHasMore(results.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [tenant?.id, dateFrom, dateTo, typeFilter, flagFilter, gateFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => fetchMovements(true), search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchMovements])

  function applyQuick(key) {
    setQuickFilter(key)
    setDateTo(todayStr())
    if (key === 'today') setDateFrom(todayStr())
    else if (key === '7d') setDateFrom(daysAgoStr(7))
    else if (key === '30d') setDateFrom(daysAgoStr(30))
    else if (key === '90d') setDateFrom(daysAgoStr(90))
  }

  return (
    <div style={{ padding: '20px' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '3px' }}>History</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            {loading ? 'Loading...' : total.toLocaleString() + ' record' + (total !== 1 ? 's' : '') + ' in selected period'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search plate number, name, destination or purpose..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '11px 40px 11px 38px',
            border: '1.5px solid var(--border-med)', borderRadius: '10px',
            fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)',
            color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-med)'}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: 'var(--bg-2)', border: 'none', borderRadius: '50%',
            width: '22px', height: '22px', cursor: 'pointer', color: 'var(--text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Quick date filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { key: 'today', label: 'Today' },
          { key: '7d', label: '7 days' },
          { key: '30d', label: '30 days' },
          { key: '90d', label: '90 days' },
          { key: 'custom', label: 'Custom range' },
        ].map(b => (
          <button key={b.key} onClick={() => b.key === 'custom' ? setQuickFilter('custom') : applyQuick(b.key)}
            className={'filter-btn' + (quickFilter === b.key ? ' active' : '')}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {quickFilter === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'From', value: dateFrom, onChange: e => setDateFrom(e.target.value) },
            { label: 'To', value: dateTo, onChange: e => setDateTo(e.target.value) },
          ].map(f => (
            <div key={f.label} style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '4px' }}>{f.label}</label>
              <input type="date" value={f.value} onChange={f.onChange}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border-med)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      )}

      {/* Secondary filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            fontWeight: flagFilter ? '700' : '400', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          {flagFilter ? 'Flagged only' : 'Show flagged'}
        </button>

        {(search || flagFilter || typeFilter !== 'all' || gateFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setFlagFilter(false); setTypeFilter('all'); setGateFilter('all') }}
            style={{ padding: '7px 10px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-2)', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
          <div style={{ fontSize: '13px' }}>Loading records...</div>
        </div>
      ) : movements.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <p style={{ color: 'var(--text-1)', fontWeight: '600', marginBottom: '4px' }}>No records found</p>
          <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Try adjusting your search or date range.</p>
        </div>
      ) : (
        <>
          {movements.map(m => (
            <MovementCard key={m.id} movement={m} onClick={() => setSelected(m)} />
          ))}
          {hasMore && (
            <button onClick={() => fetchMovements(false)} disabled={loadingMore}
              style={{
                width: '100%', padding: '13px', marginTop: '8px',
                background: 'var(--bg-1)', border: '1.5px solid var(--border-med)',
                borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-display)',
                fontWeight: '600', color: 'var(--text-1)', cursor: loadingMore ? 'not-allowed' : 'pointer'
              }}>
              {loadingMore ? 'Loading...' : 'Load more records'}
            </button>
          )}
        </>
      )}

      {selected && <MovementDetail movement={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
