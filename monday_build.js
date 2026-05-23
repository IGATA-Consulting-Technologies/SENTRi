// SENTRi — Monday Ready Build
// Fixes: incident emails, report generation button, incidents tab FK join
// Run with: node --input-type=commonjs < monday_build.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. NETLIFY FUNCTION: send-incident-email ─────────────────────────────────

const incidentEmailFn = `const https = require('https')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' }
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { to, subject, html } = JSON.parse(event.body)
    if (!to || !subject || !html) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) }

    const payload = JSON.stringify({
      from: 'SENTRi Alerts <alerts@igataconsulting.tech>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_FF99D5ZP_PRQZmErHp9hjUeSYYK5cEcM6',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }) } catch (e) { resolve({ status: res.statusCode, body: data }) } })
      })
      req.on('error', reject)
      req.write(payload)
      req.end()
    })

    return {
      statusCode: result.status === 200 || result.status === 201 ? 200 : result.status,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result.status === 200 || result.status === 201 ? { success: true } : { error: result.body })
    }
  } catch (error) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: error.message }) }
  }
}
`

// ─── 2. UPDATE email.js — add incident email + report email functions ──────────

const emailLib = `// SENTRi Email Helper
// Sends flag alert, incident alert, and report emails via Netlify proxy

async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('/.netlify/functions/send-alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    })
    const result = await response.json()
    if (result.success) console.log('Email sent to:', to)
    else console.error('Email failed:', result.error)
  } catch (e) {
    console.error('Email error:', e)
  }
}

export async function sendFlagAlertEmail({ tenantName, gateName, plate, visitorName, destination, purpose, reportEmails }) {
  if (!reportEmails?.length) return
  const identifier = plate || visitorName || 'Unknown'
  const subject = '🚨 SENTRi Flag Alert — ' + identifier + ' at ' + gateName
  const html = \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#c0132a;padding:24px 28px;">
      <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">Flag Alert — Immediate Attention Required</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">Watchlisted Entry Detected</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A flagged vehicle or person has been admitted at <strong>\${gateName}</strong>.</p>
      <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:24px;">
        \${plate ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Plate Number</div><div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#1a1a2e;">' + plate + '</div></div>' : ''}
        \${visitorName ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Visitor</div><div style="font-size:16px;font-weight:600;color:#1a1a2e;">' + visitorName + '</div></div>' : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Destination</div><div style="font-size:14px;font-weight:500;">\${destination || '—'}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Purpose</div><div style="font-size:14px;font-weight:500;">\${purpose || '—'}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Installation</div><div style="font-size:14px;font-weight:500;">\${tenantName}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Gate</div><div style="font-size:14px;font-weight:500;">\${gateName}</div></div>
        </div>
      </div>
      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Detected at <strong>\${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
      <a href="https://sentri-igata.netlify.app/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View on Command Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>\`
  await sendEmail(reportEmails, subject, html)
}

export async function sendIncidentAlertEmail({ tenantName, gateName, incidentType, severity, description, location, officerName, reportEmails }) {
  if (!reportEmails?.length) return

  const severityColor = severity === 'critical' ? '#c0132a' : severity === 'serious' ? '#92530a' : '#1a56db'
  const severityBg = severity === 'critical' ? '#c0132a' : severity === 'serious' ? '#d97706' : '#1a56db'
  const subject = (severity === 'critical' ? '🚨' : severity === 'serious' ? '⚠️' : 'ℹ️') + ' SENTRi Incident — ' + incidentType + ' at ' + gateName

  const html = \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:\${severityBg};padding:24px 28px;">
      <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:4px;">Incident Report — \${severity.toUpperCase()}</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">\${incidentType}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Reported at <strong>\${gateName}</strong> · \${tenantName}</p>
      <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:20px;">
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Severity</div>
          <span style="background:\${severityColor};color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;">\${severity}</span>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Description</div>
          <div style="font-size:14px;color:#1a1a2e;line-height:1.6;">\${description}</div>
        </div>
        \${location ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Location</div><div style="font-size:14px;color:#1a1a2e;">' + location + '</div></div>' : ''}
        \${officerName ? '<div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Reported by</div><div style="font-size:14px;color:#1a1a2e;">' + officerName + '</div></div>' : ''}
      </div>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Reported at <strong>\${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
      <a href="https://sentri-igata.netlify.app/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Acknowledge on Command Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>\`
  await sendEmail(reportEmails, subject, html)
}

export async function sendReportEmail({ tenantName, period, data, reportEmails }) {
  if (!reportEmails?.length) return
  const subject = '📊 SENTRi ' + period + ' Intelligence Report — ' + tenantName

  const dayRows = (data.byDay || []).slice(0, 14).map(d =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;">' + new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">' + d.total + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">' + d.vehicles + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">' + d.pedestrians + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;color:' + (d.flags > 0 ? '#c0132a' : '#6b7280') + ';">' + d.flags + '</td></tr>'
  ).join('')

  const destRows = (data.topDest || []).map(({ dest, count }) =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;">' + dest + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">' + count + '</td></tr>'
  ).join('')

  const html = \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1a56db;padding:28px;">
      <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:6px;">\${period} Intelligence Report</div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">\${tenantName}</div>
    </div>
    <div style="padding:28px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        \${[
          { label: 'Total Movements', value: data.total, color: '#1a56db' },
          { label: 'Vehicles', value: data.vehicles, color: '#1a1a2e' },
          { label: 'Pedestrians', value: data.pedestrians, color: '#1a1a2e' },
          { label: 'Flag Hits', value: data.flags, color: data.flags > 0 ? '#c0132a' : '#1a1a2e' },
          { label: 'Incidents', value: data.incidents, color: data.incidents > 0 ? '#92530a' : '#1a1a2e' },
          { label: 'Avg Stay', value: data.avgDuration ? data.avgDuration + 'm' : '—', color: '#1a1a2e' }
        ].map(s => '<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px;text-align:center;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">' + s.label + '</div><div style="font-size:24px;font-weight:700;color:' + s.color + ';">' + s.value + '</div></div>').join('')}
      </div>
      \${dayRows ? '<h3 style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Daily Breakdown</h3><table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Date</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Total</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Vehicles</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Pedestrians</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Flags</th></tr></thead><tbody>' + dayRows + '</tbody></table>' : ''}
      \${destRows ? '<h3 style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Top Destinations</h3><table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Destination</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Visits</th></tr></thead><tbody>' + destRows + '</tbody></table>' : ''}
      <a href="https://sentri-igata.netlify.app/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:8px;">View Full Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>\`
  await sendEmail(reportEmails, subject, html)
}
`

// ─── 3. UPDATED ReportIncidentPage — sends email after submit ─────────────────

const reportIncidentPage = `import { useState } from 'react'
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

    let officerId = null
    let officerName = guard?.name || null
    try {
      const { data: officerData } = await supabase
        .from('officers').select('id, name, rank').eq('tenant_id', tenant.id).eq('service_number', guard?.serviceNumber).single()
      officerId = officerData?.id || null
      officerName = officerData ? (officerData.rank + ' ' + officerData.name) : guard?.name || null
    } catch (e) {}

    const { error: err } = await supabase.from('incidents').insert({
      tenant_id: tenant.id, gate_id: gate?.id || null, officer_id: officerId,
      type: incidentType, severity, description: description.trim(),
      location: location.trim() || null, status: 'open'
    })

    if (err) { setError('Failed to submit: ' + err.message); setSubmitting(false); return }

    // Send email alert
    try {
      const { data: tenantData } = await supabase.from('tenants').select('name, report_emails').eq('id', tenant.id).single()
      if (tenantData?.report_emails?.length > 0) {
        await sendIncidentAlertEmail({
          tenantName: tenantData.name,
          gateName: gate?.name || 'Unknown Gate',
          incidentType: TYPE_LABELS[incidentType] || incidentType,
          severity,
          description: description.trim(),
          location: location.trim() || null,
          officerName,
          reportEmails: tenantData.report_emails
        })
      }
    } catch (e) { console.error('Incident email error:', e) }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: severity === 'critical' ? 'var(--red)' : severity === 'serious' ? 'var(--amber)' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Incident Reported</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>Report submitted. Command has been notified.</p>
      {severity === 'critical' && (
        <div style={{ background: 'rgba(192,19,42,0.1)', border: '1.5px solid rgba(192,19,42,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 20px', marginBottom: '20px', color: 'var(--red)', fontWeight: '700', fontSize: '13px' }}>
          CRITICAL — Command alerted immediately.
        </div>
      )}
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '320px' }} onClick={onBack}>Back to gate</button>
    </div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px', padding: 0 }}>← Back</button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', margin: 0 }}>Report Incident</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{gate?.name}</div>
        </div>
      </div>
      {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{error}</div>}
      <div className="field">
        <label>Incident type *</label>
        <select value={incidentType} onChange={e => setIncidentType(e.target.value)}>
          <option value="">Select incident type...</option>
          {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
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
      <div className="field">
        <label>Description *</label>
        <textarea placeholder="Describe exactly what happened..." rows={4} value={description} onChange={e => setDescription(e.target.value)}
          style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-0)', boxSizing: 'border-box', outline: 'none' }} />
      </div>
      <div className="field">
        <label>Specific location (optional)</label>
        <input type="text" placeholder="e.g. Gate entrance, North fence" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      <button className={'btn btn-full btn-lg ' + (severity === 'critical' ? 'btn-danger' : 'btn-primary')}
        onClick={submitIncident} disabled={submitting || !incidentType || !severity || !description.trim()} style={{ marginTop: '8px' }}>
        {submitting ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Submitting...</> : severity === 'critical' ? '🚨 Submit CRITICAL Incident' : 'Submit incident report'}
      </button>
    </div>
  )
}
`

// ─── 4. UPDATED ReportTab — add "Send Report" button ─────────────────────────

const reportTabAddition = `
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function sendReport() {
    setSending(true)
    try {
      const { data: tenantData } = await supabase.from('tenants').select('name, report_emails').eq('id', tenant.id).single()
      if (!tenantData?.report_emails?.length) {
        alert('No report emails configured. Add them in the Profile tab.')
        setSending(false); return
      }
      const periodLabel = PERIODS.find(p => p.key === period)?.label || period
      await sendReportEmail({ tenantName: tenantData.name, period: periodLabel, data, reportEmails: tenantData.report_emails })
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (e) { console.error('Send report error:', e) }
    setSending(false)
  }
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing files...')

// 1. Netlify function (reuse same endpoint — it already works)
// The send-alert-email.js already handles all emails — no new function needed
console.log('✓ Reusing existing send-alert-email Netlify function')

// 2. Email lib
fs.writeFileSync('src/lib/email.js', emailLib, 'utf8')
console.log('✓ src/lib/email.js — updated with incident + report email functions')

// 3. ReportIncidentPage
fs.writeFileSync('src/pages/gate/ReportIncidentPage.jsx', reportIncidentPage, 'utf8')
console.log('✓ src/pages/gate/ReportIncidentPage.jsx — incident email integrated')

// 4. Update ReportTab — add import and send button
let reportTab = fs.readFileSync('src/pages/command/ReportTab.jsx', 'utf8')
if (!reportTab.includes("from '../../lib/email'")) {
  reportTab = "import { sendReportEmail } from '../../lib/email'\n" + reportTab
  console.log('✓ Added sendReportEmail import to ReportTab')
}

// Add sending state and sendReport function before return statement
if (!reportTab.includes('sendReport')) {
  reportTab = reportTab.replace(
    '  if (loading) return',
    reportTabAddition + '\n  if (loading) return'
  )
  console.log('✓ Added sendReport function to ReportTab')
}

// Add send button to the UI - after the period filter row
if (!reportTab.includes('Send Report')) {
  reportTab = reportTab.replace(
    "        )}\n      </div>\n      {loading ? (",
    `        )}\n      </div>
      {data && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={sendReport}
            disabled={sending || !data}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {sending ? <><div className="spinner" style={{ width: '12px', height: '12px' }} /> Sending...</> : sent ? '✓ Sent!' : '📧 Email this report'}
          </button>
        </div>
      )}
      {loading ? (`
  )
  console.log('✓ Added Email Report button to ReportTab UI')
}

fs.writeFileSync('src/pages/command/ReportTab.jsx', reportTab, 'utf8')

// 5. Fix IncidentsTab FK join (same issue as AlertsTab)
let incTab = fs.readFileSync('src/pages/command/IncidentsTab.jsx', 'utf8')
incTab = incTab.replace(
  "      .select('*, gates(name), officers!incidents_officer_id_fkey(name, rank)')",
  "      .select('*, gates(name)')"
)
// Remove officers join reference in display
incTab = incTab.replace(
  "  {inc.officers?.name && <span>{inc.officers.rank} {inc.officers.name}</span>}",
  ""
)
fs.writeFileSync('src/pages/command/IncidentsTab.jsx', incTab, 'utf8')
console.log('✓ Fixed IncidentsTab FK join')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const emailContent = fs.readFileSync('src/lib/email.js', 'utf8')
const incidentContent = fs.readFileSync('src/pages/gate/ReportIncidentPage.jsx', 'utf8')
const reportContent = fs.readFileSync('src/pages/command/ReportTab.jsx', 'utf8')
const incTabContent = fs.readFileSync('src/pages/command/IncidentsTab.jsx', 'utf8')

const checks = {
  'Email: sendIncidentAlertEmail exported': emailContent.includes('export async function sendIncidentAlertEmail'),
  'Email: sendReportEmail exported': emailContent.includes('export async function sendReportEmail'),
  'Email: incident severity colors': emailContent.includes('severityColor'),
  'Incident page: imports email': incidentContent.includes("from '../../lib/email'"),
  'Incident page: sends email after submit': incidentContent.includes('sendIncidentAlertEmail'),
  'Report tab: imports sendReportEmail': reportContent.includes('sendReportEmail'),
  'Report tab: send button exists': reportContent.includes('Email this report'),
  'Incidents tab: FK join removed': !incTabContent.includes('officers!incidents_officer_id_fkey'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Monday build: incident emails, report send button, incidents tab fix"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nTest: submit an incident on guard PWA → check igataprojects@gmail.com')
console.log('Test: click Email this report on Report tab → check email')
