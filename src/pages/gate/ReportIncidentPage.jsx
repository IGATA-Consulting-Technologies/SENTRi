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
  { value: 'routine', label: 'Routine', desc: 'Minor — for record only', color: 'var(--accent)', bg: 'rgba(26,86,219,0.08)' },
  { value: 'serious', label: 'Serious', desc: 'Requires command attention', color: 'var(--amber)', bg: 'rgba(146,83,10,0.08)' },
  { value: 'critical', label: 'CRITICAL', desc: 'Immediate response needed', color: 'var(--red)', bg: 'rgba(192,19,42,0.08)' },
]

export default function ReportIncidentPage({ onBack }) {
  const { guard, gate, tenant } = useGuardStore()
  const [incidentType, setIncidentType] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submitIncident() {
    setError('')
    if (!incidentType) { setError('Please select an incident type'); return }
    if (!severity) { setError('Please select a severity level'); return }
    if (!description.trim()) { setError('Please describe what happened'); return }

    setSubmitting(true)

    // Look up officer — but don't block submit if not found
    let officerId = null
    try {
      const { data: officerData } = await supabase
        .from('officers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('service_number', guard?.serviceNumber)
        .single()
      officerId = officerData?.id || null
    } catch (e) {
      // Officer lookup failed — proceed without officer_id
    }

    const { error: err } = await supabase.from('incidents').insert({
      tenant_id: tenant.id,
      gate_id: gate?.id || null,
      officer_id: officerId,
      type: incidentType,
      severity,
      description: description.trim(),
      location: location.trim() || null,
      status: 'open'
    })

    setSubmitting(false)

    if (err) {
      console.error('Incident submit error:', err)
      setError('Failed to submit: ' + err.message)
      return
    }

    setSubmitted(true)
  }

  // Success screen
  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div className="pop" style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: severity === 'critical' ? 'var(--red)' : severity === 'serious' ? 'var(--amber)' : 'var(--green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
        Incident Reported
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>
        Report submitted successfully.
      </p>
      {severity === 'critical' && (
        <div style={{ background: 'rgba(192,19,42,0.1)', border: '1.5px solid rgba(192,19,42,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 20px', marginBottom: '20px', color: 'var(--red)', fontWeight: '700', fontSize: '13px' }}>
          CRITICAL — Command has been alerted.
        </div>
      )}
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '320px' }} onClick={onBack}>
        Back to gate
      </button>
    </div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px', padding: 0 }}>
          ← Back
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', margin: 0 }}>Report Incident</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{gate?.name}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Incident Type — dropdown */}
      <div className="field">
        <label>Incident type *</label>
        <select value={incidentType} onChange={e => setIncidentType(e.target.value)}>
          <option value="">Select incident type...</option>
          {INCIDENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Severity — clean card selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
          Severity *
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SEVERITIES.map(s => (
            <button key={s.value} onClick={() => setSeverity(s.value)}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '2px solid',
                borderColor: severity === s.value ? s.color : 'var(--border-med)',
                background: severity === s.value ? s.bg : 'var(--bg-1)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50', flexShrink: 0,
                background: severity === s.value ? s.color : 'var(--border-med)',
                borderRadius: '50%'
              }} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: s.color }}>{s.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="field">
        <label>Description *</label>
        <textarea
          placeholder="Describe exactly what happened, who was involved, and any actions taken..."
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-0)', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Location */}
      <div className="field">
        <label>Specific location (optional)</label>
        <input type="text" placeholder="e.g. Gate entrance, North fence, Checkpoint B"
          value={location} onChange={e => setLocation(e.target.value)} />
      </div>

      {/* Submit */}
      <button
        className={'btn btn-full btn-lg ' + (severity === 'critical' ? 'btn-danger' : 'btn-primary')}
        onClick={submitIncident}
        disabled={submitting || !incidentType || !severity || !description.trim()}
        style={{ marginTop: '8px' }}
      >
        {submitting
          ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Submitting...</>
          : severity === 'critical'
            ? '🚨 Submit CRITICAL Incident'
            : 'Submit incident report'
        }
      </button>
    </div>
  )
}
