const https = require('https')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://zrnkwhxsqxkaimvyqixg.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const RESEND_KEY = 're_FF99D5ZP_PRQZmErHp9hjUeSYYK5cEcM6'
const FROM = 'SENTRi Intelligence <alerts@igataconsulting.tech>'

async function sendEmail(to, subject, html) {
  const payload = JSON.stringify({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html
  })
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode }))
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// Mobile-safe stat cell — used in a 2-column table row
function statCell(label, value, color) {
  return (
    '<td width="50%" style="padding:6px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;">' +
        '<tr><td style="padding:14px;text-align:center;">' +
          '<p style="margin:0 0 4px 0;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">' + label + '</p>' +
          '<p style="margin:0;font-size:22px;font-weight:700;color:' + (color || '#1a1a2e') + ';font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">' + value + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td>'
  )
}

// Mobile-safe destination row
function destRow(dest, count, isLast) {
  return (
    '<tr>' +
      '<td style="padding:8px 0;font-size:14px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' + (isLast ? '' : 'border-bottom:1px solid #f0f2f5;') + '">' + dest + '</td>' +
      '<td style="padding:8px 0;font-size:14px;font-weight:700;color:#1a56db;text-align:right;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' + (isLast ? '' : 'border-bottom:1px solid #f0f2f5;') + '">' + count + '</td>' +
    '</tr>'
  )
}

function buildDigestHTML(tenant, officerName, stats, weekLabel) {
  const { total, vehicles, pedestrians, flags, incidents, criticalIncidents, topDest, activeDays, offHours } = stats

  const hasAlerts = flags > 0 || incidents > 0
  const alertBg = hasAlerts ? '#fff5f5' : '#f0fdf4'
  const alertBorder = hasAlerts ? '#fecaca' : '#bbf7d0'
  const alertColor = hasAlerts ? '#c0132a' : '#0e7c3a'
  const statusMsg = criticalIncidents > 0
    ? 'Critical incidents require your immediate attention.'
    : flags > 0
    ? 'Watchlist alerts were triggered this week. Review on your dashboard.'
    : incidents > 0
    ? 'Incidents were logged this week.'
    : 'No security alerts this week. Operations are normal.'

  // Build 2-per-row stat table (safe on all clients including Outlook)
  const statsRows =
    '<tr>' + statCell('Total Movements', total, '#1a56db') + statCell('Active Days', activeDays, '#1a1a2e') + '</tr>' +
    '<tr style="margin-top:8px;">' + statCell('Vehicles', vehicles, '#1a1a2e') + statCell('Pedestrians', pedestrians, '#1a1a2e') + '</tr>' +
    '<tr style="margin-top:8px;">' + statCell('Flag Alerts', flags, flags > 0 ? '#c0132a' : '#1a1a2e') + statCell('Incidents', incidents, incidents > 0 ? '#92530a' : '#1a1a2e') + '</tr>'

  const destRows = (topDest || []).slice(0, 5).map((d, i, arr) =>
    destRow(d.dest, d.count, i === arr.length - 1)
  ).join('')

  // Full table-based email — no Grid, no Flexbox, all inline styles
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>SENTRi Weekly Digest</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Email container -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">SENTRi</p>
                  <p style="margin:3px 0 0;color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Weekly Intelligence Digest</p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;">
                  <p style="margin:0;color:rgba(255,255,255,0.9);font-size:15px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${tenant}</p>
                  <p style="margin:3px 0 0;color:rgba(255,255,255,0.6);font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${weekLabel}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Hello ${officerName},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Here is your weekly intelligence digest for the period ending ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>

            <!-- Status banner -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:${alertBg};border:1px solid ${alertBorder};border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:${alertColor};text-transform:uppercase;letter-spacing:0.07em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Week at a Glance</p>
                  <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${statusMsg}</p>
                </td>
              </tr>
            </table>

            <!-- Stats — 2 per row, table-based -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Movement Statistics</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;border-collapse:separate;border-spacing:0 8px;">
              ${statsRows}
            </table>

            ${offHours > 0 ? `
            <!-- Off-hours alert -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
                  <p style="margin:0;font-size:14px;color:#92530a;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><strong>${offHours} off-hours movement(s)</strong> were recorded this week. Please verify these entries against your authorised night-access roster.</p>
                </td>
              </tr>
            </table>
            ` : ''}

            ${destRows ? `
            <!-- Top destinations -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Top Destinations This Week</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              ${destRows}
            </table>
            ` : ''}

            ${criticalIncidents > 0 ? `
            <!-- Critical alert -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="background:#fff5f5;border:2px solid #c0132a;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#c0132a;text-transform:uppercase;letter-spacing:0.07em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">&#9888; Critical Incidents Require Action</p>
                  <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${criticalIncidents} critical incident(s) were logged this week. Review and confirm escalation status immediately.</p>
                </td>
              </tr>
            </table>
            ` : ''}

            <!-- CTA button — table-based for all clients -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
              <tr>
                <td align="center">
                  <a href="https://sentri-igata.netlify.app/command"
                     style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.02em;">
                    View Full Dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:14px 32px;border-top:1px solid #e2e6ed;background:#f8f9fb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:11px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Powered by IGATA Technologies</td>
                <td style="font-size:11px;color:#9ca3af;text-align:right;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">SENTRi Movement Intelligence</td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- End email container -->

    </td>
  </tr>
</table>
<!-- End outer wrapper -->

</body>
</html>`
}

exports.handler = async (event) => {
  console.log('Weekly digest starting...')
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekLabel = 'Week of ' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id,name')
    .eq('is_active', true)
    .eq('onboarding_complete', true)

  if (!tenants?.length) {
    console.log('No active tenants')
    return { statusCode: 200, body: 'No tenants' }
  }

  let sent = 0
  for (const tenant of tenants) {
    try {
      const [movRes, incRes, flagRes, officerRes] = await Promise.all([
        supabase.from('movements').select('id,type,flag_triggered,destination,entry_time').eq('tenant_id', tenant.id).gte('entry_time', weekAgo),
        supabase.from('incidents').select('id,severity').eq('tenant_id', tenant.id).gte('created_at', weekAgo),
        supabase.from('flag_alerts').select('id').eq('tenant_id', tenant.id).gte('alerted_at', weekAgo),
        supabase.from('officers').select('name,email,rank').eq('tenant_id', tenant.id).eq('role', 'command').eq('is_active', true).limit(1).single()
      ])

      if (!officerRes.data?.email) {
        console.log('No officer email for', tenant.name)
        continue
      }

      const movements = movRes.data || []
      const incidents = incRes.data || []
      const flags = flagRes.data || []

      const destMap = {}
      movements.forEach(m => { if (m.destination) destMap[m.destination] = (destMap[m.destination] || 0) + 1 })
      const topDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dest, count]) => ({ dest, count }))
      const activeDaySet = new Set(movements.map(m => m.entry_time.split('T')[0]))
      const offHours = movements.filter(m => { const h = new Date(m.entry_time).getHours(); return h < 6 || h >= 22 }).length

      const stats = {
        total: movements.length,
        vehicles: movements.filter(m => m.type === 'vehicle').length,
        pedestrians: movements.filter(m => m.type === 'pedestrian').length,
        flags: flags.length,
        incidents: incidents.length,
        criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
        topDest,
        activeDays: activeDaySet.size,
        offHours
      }

      const officerName = [officerRes.data.rank, officerRes.data.name].filter(Boolean).join(' ')
      const html = buildDigestHTML(tenant.name, officerName, stats, weekLabel)
      const subject = 'SENTRi Weekly Digest — ' + tenant.name + ' — ' + weekLabel

      await sendEmail(officerRes.data.email, subject, html)
      console.log('Digest sent to', officerRes.data.email, 'for', tenant.name)
      sent++
    } catch (e) {
      console.error('Digest error for', tenant.name, ':', e.message)
    }
  }

  return { statusCode: 200, body: JSON.stringify({ sent }) }
}
