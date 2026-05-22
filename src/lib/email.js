// SENTRi Email Helper
// Sends alert emails via the Netlify proxy function

export async function sendFlagAlertEmail({ tenantName, gateName, plate, visitorName, destination, purpose, reportEmails }) {
  if (!reportEmails || reportEmails.length === 0) return

  const identifier = plate || visitorName || 'Unknown'
  const subject = '🚨 SENTRi Flag Alert — ' + identifier + ' at ' + gateName

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background:#c0132a;padding:24px 28px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:20px;">🛡️</span>
            </div>
            <div>
              <div style="color:white;font-size:18px;font-weight:700;letter-spacing:0.05em;">SENTRi</div>
              <div style="color:rgba(255,255,255,0.8);font-size:12px;">Flag Alert — Immediate Attention Required</div>
            </div>
          </div>
        </div>

        <!-- Alert body -->
        <div style="padding:28px;">
          <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a2e;">
            Watchlisted Entry Detected
          </h2>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
            A flagged vehicle or person has been admitted at <strong>${gateName}</strong>.
          </p>

          <!-- Details card -->
          <div style="background:#f8f9fb;border:1.5px solid #e2e6ed;border-radius:8px;padding:18px;margin-bottom:24px;">
            ${plate ? `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Plate Number</div>
              <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#1a1a2e;">${plate}</div>
            </div>` : ''}
            ${visitorName ? `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Visitor Name</div>
              <div style="font-size:16px;font-weight:600;color:#1a1a2e;">${visitorName}</div>
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px;">
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Destination</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">${destination || '—'}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Purpose</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">${purpose || '—'}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Installation</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">${tenantName}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Gate</div>
                <div style="font-size:14px;font-weight:500;color:#1a1a2e;">${gateName}</div>
              </div>
            </div>
          </div>

          <!-- Time -->
          <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
            Detected at <strong>${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
          </p>

          <!-- CTA -->
          <a href="https://sentri-igata.netlify.app/command" 
             style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.03em;">
            View on Command Dashboard →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
          <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence</span>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    const response = await fetch('/.netlify/functions/send-alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: reportEmails, subject, html })
    })
    const result = await response.json()
    if (result.success) {
      console.log('Flag alert email sent to:', reportEmails)
    } else {
      console.error('Email send failed:', result.error)
    }
  } catch (e) {
    console.error('Email helper error:', e)
  }
}
