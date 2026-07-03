import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const TYPE_LABELS = {
  unauthorized_access: 'Unauthorized Access',
  suspicious_vehicle: 'Suspicious Vehicle',
  suspicious_person: 'Suspicious Person',
  altercation: 'Altercation',
  medical_emergency: 'Medical Emergency',
  equipment_issue: 'Equipment Issue',
  perimeter_breach: 'Perimeter Breach',
  contraband_detected: 'Contraband Detected',
  other: 'Other'
}
const SEVERITY_COLORS = { routine: 'badge-blue', serious: 'badge-amber', critical: 'badge-red' }
const STATUS_COLORS = { open: 'badge-red', acknowledged: 'badge-amber', resolved: 'badge-green' }

export default function IncidentsTab({ onCountChange }) {
  const { tenant, officer } = useAuthStore()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    fetchIncidents()
    const ch = supabase.channel('incidents-command')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', filter: 'tenant_id=eq.' + tenant.id }, fetchIncidents)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [filter])

  async function fetchIncidents() {
    setLoading(true)
    let q = supabase.from('incidents')
      .select('*, gates(name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setIncidents(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const update = { status }
    if (status === 'acknowledged') { update.acknowledged_by = officer.id; update.acknowledged_at = new Date().toISOString() }
    if (status === 'resolved') { update.resolved_by = officer.id; update.resolved_at = new Date().toISOString() }
    await supabase.from('incidents').update(update).eq('id', id)
    fetchIncidents()
    if (onCountChange) onCountChange()
  }

  const openCount = incidents.filter(i => i.status === 'open').length

  return (
    <div className="incidents-tab">
      <div className="tab-header">
        <div>
          <h2>Incidents {openCount > 0 && <span className="badge badge-red">{openCount} open</span>}</h2>
          <p className="tab-sub">All reported incidents from gate officers.</p>
        </div>
      </div>
      <div className="filter-row">
        {['open', 'acknowledged', 'resolved', 'all'].map(f => (
          <button key={f} className={'filter-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="loading-state">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="empty-state"><p>No {filter !== 'all' ? filter : ''} incidents.</p></div>
      ) : (
        <div className="incidents-list">
          {incidents.map(inc => (
            <div key={inc.id} className={'incident-card severity-' + inc.severity}>
              <div className="incident-header">
                <div className="incident-title-row">
                  <span className="incident-type">{TYPE_LABELS[inc.type] || inc.type}</span>
                  <span className={'badge ' + SEVERITY_COLORS[inc.severity]}>{inc.severity}</span>
                  <span className={'badge ' + STATUS_COLORS[inc.status]}>{inc.status}</span>
                </div>
                <div className="incident-meta">
                  {inc.gates?.name && <span>{inc.gates.name}</span>}
                
                  <span>{new Date(inc.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="incident-description">{inc.description}</p>
              {inc.location && <p className="incident-location">{inc.location}</p>}

              {/* Photo attachments */}
              {inc.media_urls?.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' }}>
                  {inc.media_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1.5px solid var(--border-med)' }}>
                      <img src={url} alt={'Photo ' + (i + 1)}
                        style={{ width: '100px', height: '80px', objectFit: 'cover', display: 'block' }} />
                    </a>
                  ))}
                </div>
              )}

              {/* Voice note */}
              {inc.voice_url && (
                <div style={{ margin: '10px 0', padding: '10px 14px', background: 'rgba(14,124,58,0.06)', border: '1.5px solid rgba(14,124,58,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--green)', marginRight: '8px' }}>Voice note</span>
                  <audio controls src={inc.voice_url} style={{ height: '28px', flex: 1, maxWidth: '220px' }} />
                </div>
              )}

              {inc.status === 'open' && (
                <div className="incident-actions">
                  <button className="btn-amber" onClick={() => updateStatus(inc.id, 'acknowledged')}>Acknowledge</button>
                  <button className="btn-green" onClick={() => updateStatus(inc.id, 'resolved')}>Mark Resolved</button>
                </div>
              )}
              {inc.status === 'acknowledged' && (
                <div className="incident-actions">
                  <button className="btn-green" onClick={() => updateStatus(inc.id, 'resolved')}>Mark Resolved</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
