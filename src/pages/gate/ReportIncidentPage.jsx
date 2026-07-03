import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import { sendIncidentAlertEmail } from '../../lib/email'

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

const TYPE_LABELS = {
  unauthorized_access: 'Unauthorized Access Attempt',
  suspicious_vehicle: 'Suspicious Vehicle',
  suspicious_person: 'Suspicious Person',
  altercation: 'Altercation',
  medical_emergency: 'Medical Emergency',
  equipment_issue: 'Equipment Issue',
  perimeter_breach: 'Perimeter Breach',
  contraband_detected: 'Contraband Detected',
  other: 'Other'
}

const MAX_PHOTOS = 3
const MAX_VOICE_SECONDS = 90

export default function ReportIncidentPage({ onBack }) {
  const { guard, gate, tenant } = useGuardStore()
  const [incidentType, setIncidentType] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Media state
  const [photos, setPhotos] = useState([]) // array of { file, preview }
  const [voiceBlob, setVoiceBlob] = useState(null)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [uploadProgress, setUploadProgress] = useState('')

  const photoInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  // ── PHOTO HANDLING ─────────────────────────────────────────────────────────

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    setPhotos(prev => [...prev, ...toAdd])
    e.target.value = ''
  }

  function removePhoto(idx) {
    setPhotos(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[idx].preview)
      next.splice(idx, 1)
      return next
    })
  }

  // ── VOICE RECORDING ────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setVoiceBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }

      mr.start()
      setRecording(true)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s + 1 >= MAX_VOICE_SECONDS) {
            stopRecording()
            return MAX_VOICE_SECONDS
          }
          return s + 1
        })
      }, 1000)
    } catch (e) {
      setError('Microphone access denied. Please allow microphone permission.')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      setVoiceDuration(recordingSeconds)
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  function clearVoice() {
    setVoiceBlob(null)
    setVoiceDuration(0)
    setRecordingSeconds(0)
  }

  function formatSecs(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // ── UPLOAD HELPERS ─────────────────────────────────────────────────────────

  async function uploadMedia(incidentId) {
    const folder = `${tenant.id}/${incidentId}`
    const urls = []

    for (let i = 0; i < photos.length; i++) {
      setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}...`)
      const { file } = photos[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${folder}/photo_${i + 1}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('incident-media')
        .upload(path, file, { upsert: true })
      if (upErr) { console.error('Photo upload error:', upErr.message); continue }
      const { data: { publicUrl } } = supabase.storage
        .from('incident-media')
        .getPublicUrl(path)
      urls.push(publicUrl)
    }

    let voiceUrl = null
    if (voiceBlob) {
      setUploadProgress('Uploading voice note...')
      const path = `${folder}/voice.webm`
      const { error: vErr } = await supabase.storage
        .from('incident-media')
        .upload(path, voiceBlob, { upsert: true, contentType: 'audio/webm' })
      if (!vErr) {
        const { data: { publicUrl } } = supabase.storage
          .from('incident-media')
          .getPublicUrl(path)
        voiceUrl = publicUrl
      } else {
        console.error('Voice upload error:', vErr.message)
      }
    }

    setUploadProgress('')
    return { mediaUrls: urls, voiceUrl }
  }

  // ── SUBMIT ─────────────────────────────────────────────────────────────────

  async function submitIncident() {
    setError('')
    if (!incidentType) { setError('Please select an incident type'); return }
    if (!severity) { setError('Please select a severity level'); return }
    if (!description.trim()) { setError('Please describe what happened'); return }

    setSubmitting(true)

    let officerId = null
    let officerName = guard?.name || null
    try {
      const { data: officerData } = await supabase
        .from('officers').select('id, name, rank').eq('tenant_id', tenant.id).eq('service_number', guard?.serviceNumber).single()
      officerId = officerData?.id || null
      officerName = officerData ? (officerData.rank + ' ' + officerData.name) : guard?.name || null
    } catch (e) {}

    // Generate ID client-side so we don't need a SELECT after insert
    // (avoids needing a SELECT RLS policy for unauthenticated guards)
    const incidentId = crypto.randomUUID()
    const { error: err } = await supabase.from('incidents').insert({
      id: incidentId,
      tenant_id: tenant.id, gate_id: gate?.id || null, officer_id: officerId,
      type: incidentType, severity, description: description.trim(),
      location: location.trim() || null, status: 'open'
    })

    if (err) { setError('Failed to submit: ' + err.message); setSubmitting(false); return }

    // Show success immediately — incident is recorded in the database.
    // Media upload and email alert fire in the background so the guard
    // is not blocked waiting for network operations to complete.
    setSubmitting(false)
    setSubmitted(true)

    // Background: upload media and update incident record
    if (photos.length > 0 || voiceBlob) {
      uploadMedia(incidentId).then(({ mediaUrls, voiceUrl }) => {
        if (mediaUrls.length > 0 || voiceUrl) {
          supabase.from('incidents').update({
            media_urls: mediaUrls,
            voice_url: voiceUrl
          }).eq('id', incident.id).then(() => {})
        }
      }).catch(e => console.error('Background media upload error:', e))
    }

    // Background: send email alert
    supabase.from('tenants').select('name, report_emails').eq('id', tenant.id).single().then(({ data: tenantData }) => {
      if (tenantData?.report_emails?.length > 0) {
        sendIncidentAlertEmail({
          tenantName: tenantData.name,
          gateName: gate?.name || 'Unknown Gate',
          incidentType: TYPE_LABELS[incidentType] || incidentType,
          severity,
          description: description.trim(),
          location: location.trim() || null,
          officerName,
          reportEmails: tenantData.report_emails
        }).catch(e => console.error('Incident email error:', e))
      }
    }).catch(e => console.error('Tenant fetch error:', e))
  }

  // ── SUCCESS SCREEN ─────────────────────────────────────────────────────────

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: severity === 'critical' ? 'var(--red)' : severity === 'serious' ? 'var(--amber)' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Incident Reported</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>Report submitted. Command has been notified.</p>
      {photos.length > 0 && <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }}>{photos.length} photo{photos.length > 1 ? 's' : ''} attached</p>}
      {voiceBlob && <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px' }}>Voice note attached ({formatSecs(voiceDuration)})</p>}
      {severity === 'critical' && (
        <div style={{ background: 'rgba(192,19,42,0.1)', border: '1.5px solid rgba(192,19,42,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 20px', marginBottom: '20px', color: 'var(--red)', fontWeight: '700', fontSize: '13px' }}>
          CRITICAL — Command alerted immediately.
        </div>
      )}
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '320px' }} onClick={onBack}>Back to gate</button>
    </div>
  )

  // ── FORM ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px', padding: 0 }}>← Back</button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', margin: 0 }}>Report Incident</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{gate?.name}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      {/* Incident type */}
      <div className="field">
        <label>Incident type *</label>
        <select value={incidentType} onChange={e => setIncidentType(e.target.value)}>
          <option value="">Select incident type...</option>
          {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Severity */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>Severity *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SEVERITIES.map(s => (
            <button key={s.value} onClick={() => setSeverity(s.value)}
              style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: severity === s.value ? s.color : 'var(--border-med)', background: severity === s.value ? s.bg : 'var(--bg-1)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: severity === s.value ? s.color : 'var(--border-med)' }} />
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
        <textarea placeholder="Describe exactly what happened..." rows={4} value={description} onChange={e => setDescription(e.target.value)}
          style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-0)', boxSizing: 'border-box', outline: 'none' }} />
      </div>

      {/* Location */}
      <div className="field">
        <label>Specific location (optional)</label>
        <input type="text" placeholder="e.g. Gate entrance, North fence" value={location} onChange={e => setLocation(e.target.value)} />
      </div>

      {/* ── PHOTOS ── */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
          Photos ({photos.length}/{MAX_PHOTOS})
        </label>

        {/* Photo previews */}
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: '90px', height: '90px' }}>
                <img src={p.preview} alt={`Photo ${i + 1}`}
                  style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-med)' }} />
                <button onClick={() => removePhoto(i)}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--red)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add photo button */}
        {photos.length < MAX_PHOTOS && (
          <>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <button onClick={() => photoInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1.5px dashed var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', width: '100%', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              {photos.length === 0 ? 'Add photos (up to 3)' : `Add ${MAX_PHOTOS - photos.length} more photo${MAX_PHOTOS - photos.length > 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>

      {/* ── VOICE NOTE ── */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
          Voice Note (max {formatSecs(MAX_VOICE_SECONDS)})
        </label>

        {voiceBlob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(14,124,58,0.06)', border: '1.5px solid rgba(14,124,58,0.2)', borderRadius: 'var(--radius-md)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)' }}>Voice note recorded</div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{formatSecs(voiceDuration)} recorded</div>
            </div>
            <audio controls src={URL.createObjectURL(voiceBlob)} style={{ height: '32px', maxWidth: '140px' }} />
            <button onClick={clearVoice} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        ) : recording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(192,19,42,0.06)', border: '1.5px solid rgba(192,19,42,0.25)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--red)' }}>Recording... {formatSecs(recordingSeconds)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Max {formatSecs(MAX_VOICE_SECONDS)}</div>
            </div>
            <button onClick={stopRecording}
              style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
              Stop
            </button>
          </div>
        ) : (
          <button onClick={startRecording}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1.5px dashed var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', width: '100%', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            Record voice note
          </button>
        )}
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div style={{ fontSize: '13px', color: 'var(--text-2)', textAlign: 'center', marginBottom: '12px' }}>
          <div className="spinner" style={{ width: '14px', height: '14px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
          {uploadProgress}
        </div>
      )}

      {/* Submit */}
      <button
        className={'btn btn-full btn-lg ' + (severity === 'critical' ? 'btn-danger' : 'btn-primary')}
        onClick={submitIncident}
        disabled={submitting || !incidentType || !severity || !description.trim()}
        style={{ marginTop: '8px' }}>
        {submitting
          ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> {uploadProgress || 'Submitting...'}</>
          : severity === 'critical' ? '🚨 Submit CRITICAL Incident' : 'Submit incident report'}
      </button>
    </div>
  )
}
