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

export default function IncidentsTab() {
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
      .select('*, gates(name), officers!incidents_officer_id_fkey(name, rank)')
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
                  {inc.officers?.name && <span>{inc.officers.rank} {inc.officers.name}</span>}
                  <span>{new Date(inc.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="incident-description">{inc.description}</p>
              {inc.location && <p className="incident-location">{inc.location}</p>}
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
