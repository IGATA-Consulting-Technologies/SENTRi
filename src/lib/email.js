// SENTRi Email Helper
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
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#c0132a;padding:24px 28px;">
      <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">Flag Alert — Immediate Attention Required</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">Watchlisted Entry Detected</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A flagged vehicle or person has been admitted at <strong>${gateName}</strong>.</p>
      <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:24px;">
        ${plate ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Plate Number</div><div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#1a1a2e;">' + plate + '</div></div>' : ''}
        ${visitorName ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Visitor</div><div style="font-size:16px;font-weight:600;color:#1a1a2e;">' + visitorName + '</div></div>' : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Destination</div><div style="font-size:14px;font-weight:500;">${destination || '—'}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Purpose</div><div style="font-size:14px;font-weight:500;">${purpose || '—'}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Installation</div><div style="font-size:14px;font-weight:500;">${tenantName}</div></div>
          <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Gate</div><div style="font-size:14px;font-weight:500;">${gateName}</div></div>
        </div>
      </div>
      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Detected at <strong>${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
      <a href="https://app.sentri.ng/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View on Command Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>`
  await sendEmail(reportEmails, subject, html)
}

export async function sendIncidentAlertEmail({ tenantName, gateName, incidentType, severity, description, location, officerName, reportEmails, mediaUrls, voiceUrl }) {
  if (!reportEmails?.length) return

  const severityColor = severity === 'critical' ? '#c0132a' : severity === 'serious' ? '#92530a' : '#1a56db'
  const severityBg = severity === 'critical' ? '#c0132a' : severity === 'serious' ? '#d97706' : '#1a56db'
  const subject = (severity === 'critical' ? '🚨' : severity === 'serious' ? '⚠️' : 'ℹ️') + ' SENTRi Incident — ' + incidentType + ' at ' + gateName

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:${severityBg};padding:24px 28px;">
      <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:4px;">Incident Report — ${severity.toUpperCase()}</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">${incidentType}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Reported at <strong>${gateName}</strong> · ${tenantName}</p>
      <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:20px;">
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Severity</div>
          <span style="background:${severityColor};color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;">${severity}</span>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Description</div>
          <div style="font-size:14px;color:#1a1a2e;line-height:1.6;">${description}</div>
        </div>
        ${location ? '<div style="margin-bottom:14px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Location</div><div style="font-size:14px;color:#1a1a2e;">' + location + '</div></div>' : ''}
        ${officerName ? '<div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Reported by</div><div style="font-size:14px;color:#1a1a2e;">' + officerName + '</div></div>' : ''}
      </div>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Reported at <strong>${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
      ${mediaUrls && mediaUrls.length > 0 ? \`<div style="margin-bottom:20px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Attached Photos</div><div style="display:flex;gap:8px;flex-wrap:wrap;">\${mediaUrls.map(url => \`<a href="\${url}" target="_blank" style="display:block;"><img src="\${url}" style="width:120px;height:90px;object-fit:cover;border-radius:6px;border:1.5px solid #e2e6ed;" /></a>\`).join('')}</div></div>\` : ''}
      \${voiceUrl ? \`<div style="margin-bottom:20px;padding:14px 16px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;"><div style="font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Voice Note</div><a href="\${voiceUrl}" target="_blank" style="font-size:13px;font-weight:600;color:#15803d;text-decoration:none;">▶ Tap to download &amp; play voice note</a></div>\` : ''}
      <a href="https://app.sentri.ng/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Acknowledge on Command Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>`
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

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1a56db;padding:28px;">
      <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">🛡️ SENTRi</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:6px;">${period} Intelligence Report</div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">${tenantName}</div>
    </div>
    <div style="padding:28px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${[
          { label: 'Total Movements', value: data.total, color: '#1a56db' },
          { label: 'Vehicles', value: data.vehicles, color: '#1a1a2e' },
          { label: 'Pedestrians', value: data.pedestrians, color: '#1a1a2e' },
          { label: 'Flag Hits', value: data.flags, color: data.flags > 0 ? '#c0132a' : '#1a1a2e' },
          { label: 'Incidents', value: data.incidents, color: data.incidents > 0 ? '#92530a' : '#1a1a2e' },
          { label: 'Avg Stay', value: data.avgDuration ? data.avgDuration + 'm' : '—', color: '#1a1a2e' }
        ].map(s => '<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px;text-align:center;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">' + s.label + '</div><div style="font-size:24px;font-weight:700;color:' + s.color + ';">' + s.value + '</div></div>').join('')}
      </div>
      ${dayRows ? '<h3 style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Daily Breakdown</h3><table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Date</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Total</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Vehicles</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Pedestrians</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Flags</th></tr></thead><tbody>' + dayRows + '</tbody></table>' : ''}
      ${destRows ? '<h3 style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Top Destinations</h3><table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Destination</th><th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;">Visits</th></tr></thead><tbody>' + destRows + '</tbody></table>' : ''}
      <a href="https://app.sentri.ng/command" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:8px;">View Full Dashboard →</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
      <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
    </div>
  </div></body></html>`
  await sendEmail(reportEmails, subject, html)
}
