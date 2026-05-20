import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

const INCIDENT_TYPES = [
  { value: 'unauthorized_access', label: 'Unauthorized Access Attempt' },
  { value: 'suspicious_vehicle', label: 'Suspicious Vehicle' },
  { value: 'suspicious_person', label: 'Suspicious Person' },
  { value: 'altercation', label: 'Altercation' },
  { value: 'medical_emergency', label: 'Medical Emergency' },
  { value: 'equipment_issue', label: 'Equipment Issue' },
  { value: 'perimeter_breach', label: 'Perimeter Breach' },
  { value: 'contraband_detected', label: 'Contraband Detected' },
  { value: 'other', label: 'Other' },
]

const SEVERITIES = [
  { value: 'routine', label: 'Routine', desc: 'Minor, for record only', color: '#1a56db' },
  { value: 'serious', label: 'Serious', desc: 'Requires attention', color: '#92530a' },
  { value: 'critical', label: 'CRITICAL', desc: 'Immediate response needed', color: '#c0132a' },
]

export default function ReportIncidentPage({ onBack }) {
  const { guard, gate, tenant } = useGuardStore()
  const [form, setForm] = useState({ type: '', severity: '', description: '', location: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submitIncident() {
    setError('')
    if (!form.type) { setError('Select an incident type'); return }
    if (!form.severity) { setError('Select severity level'); return }
    if (!form.description.trim()) { setError('Description is required'); return }
    setSubmitting(true)
    const { data: officerData } = await supabase
      .from('officers').select('id').eq('tenant_id', tenant.id).eq('service_number', guard.serviceNumber).single()
    const { error: err } = await supabase.from('incidents').insert({
      tenant_id: tenant.id, gate_id: gate.id, officer_id: officerData?.id || null,
      type: form.type, severity: form.severity, description: form.description.trim(),
      location: form.location.trim() || null, status: 'open'
    })
    setSubmitting(false)
    if (err) { setError(err.message); return }
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="incident-submitted">
      <h2>Incident Reported</h2>
      <p>Report submitted. Duty officer has been notified.</p>
      {form.severity === 'critical' && <div className="critical-notice">CRITICAL — Command alerted immediately.</div>}
      <button className="btn-primary" onClick={onBack}>Back to Gate</button>
    </div>
  )

  return (
    <div className="report-incident-page">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h2>Report Incident</h2>
        <p>{gate?.name} / {guard?.name}</p>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-section">
        <label>Incident Type *</label>
        <div className="type-grid">
          {INCIDENT_TYPES.map(t => (
            <button
              key={t.value}
              className={'type-btn' + (form.type === t.value ? ' selected' : '')}
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <label>Severity *</label>
        <div className="severity-grid">
          {SEVERITIES.map(s => (
            <button
              key={s.value}
              className={'severity-btn' + (form.severity === s.value ? ' selected' : '')}
              style={form.severity === s.value ? { borderColor: s.color, background: s.color + '15' } : {}}
              onClick={() => setForm(f => ({ ...f, severity: s.value }))}
            >
              <span style={{ color: s.color }}>{s.label}</span>
              <span className="severity-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <label>Description *</label>
        <textarea
          placeholder="Describe what happened in detail..."
          rows={4}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="form-section">
        <label>Specific Location (optional)</label>
        <input
          placeholder="e.g. Gate entrance, North fence"
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
        />
      </div>
      <button
        className={'btn-submit-incident' + (form.severity === 'critical' ? ' critical' : '')}
        onClick={submitIncident}
        disabled={submitting}
      >
        {submitting ? 'Submitting...' : form.severity === 'critical' ? 'Submit CRITICAL Incident' : 'Submit Incident Report'}
      </button>
    </div>
  )
}
