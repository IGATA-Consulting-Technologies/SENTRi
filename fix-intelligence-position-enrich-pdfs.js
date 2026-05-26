const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Fix Intelligence nav position + enrich PDFs with flags and incidents')
console.log('='.repeat(70))

// ── 1. Fix CommandApp TABS array ──
const commandPath = path.join(process.cwd(), 'src', 'pages', 'command', 'CommandApp.jsx')
let commandContent = fs.readFileSync(commandPath, 'utf8').replace(/^\uFEFF/, '')

const correctTabs = `const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'report', label: 'Report' },
  { key: 'gates', label: 'Gates' },
  { key: 'profile', label: 'Profile' },
  { key: 'intelligence', label: 'Intelligence' },
]`

// Replace entire TABS block
commandContent = commandContent.replace(
  /const TABS = \[[\s\S]*?\]/,
  correctTabs
)

// Ensure intelligence case exists in renderTab
if (!commandContent.includes("case 'intelligence'")) {
  commandContent = commandContent.replace(
    "case 'profile': return <ProfileTab />",
    "case 'profile': return <ProfileTab />\n      case 'intelligence': return <IntelligenceTab />"
  )
  console.log('✓ Added Intelligence case to renderTab')
} else {
  console.log('✓ Intelligence case already in renderTab')
}

// Style Intelligence tab button differently — accent border to signal it's special
commandContent = commandContent.replace(
  `background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-1)',`,
  `background: activeTab === tab.key ? (tab.key === 'intelligence' ? '#0a0f1e' : 'var(--accent)') : tab.key === 'intelligence' ? 'rgba(10,15,30,0.06)' : 'transparent',
              color: activeTab === tab.key ? 'white' : tab.key === 'intelligence' ? '#0a0f1e' : 'var(--text-1)',
              fontWeight: tab.key === 'intelligence' ? 700 : 500,`
)

fs.writeFileSync(commandPath, commandContent, 'utf8')
console.log('✓ CommandApp.jsx updated — Intelligence moved to last position with distinct styling')

// Verify
const tabMatch = commandContent.match(/const TABS = \[[\s\S]*?\]/)
if (tabMatch) {
  const lastKey = [...tabMatch[0].matchAll(/key: '(\w+)'/g)].pop()
  console.log('✓ Last tab in nav:', lastKey ? lastKey[1] : 'unknown')
}

// ── 2. Enrich IntelligenceTab with flag alerts and incidents data + PDF ──
const intelPath = path.join(process.cwd(), 'src', 'pages', 'command', 'IntelligenceTab.jsx')
let intelContent = fs.readFileSync(intelPath, 'utf8').replace(/^\uFEFF/, '')

// Add flag_alerts and incidents fetch to the analyse() function
// Replace the existing Promise.all in analyse()
intelContent = intelContent.replace(
  `const [movRes, repRes] = await Promise.all([
      supabase.from('movements')
        .select('id,type,plate_number,visitor_name,id_number,destination,purpose,occupants,notes,entry_time,exit_time,duration_minutes,flag_triggered,ocr_confidence,gate_id,gates(name)')
        .eq('tenant_id', tenant.id)
        .gte('entry_time', since90)
        .order('entry_time', { ascending: true }),
      supabase.from('v_repeat_visitors')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('visit_count', { ascending: false })
        .limit(20)
    ])`,
  `const [movRes, repRes, flagRes, incRes] = await Promise.all([
      supabase.from('movements')
        .select('id,type,plate_number,visitor_name,id_number,destination,purpose,occupants,notes,entry_time,exit_time,duration_minutes,flag_triggered,ocr_confidence,gate_id,gates(name)')
        .eq('tenant_id', tenant.id)
        .gte('entry_time', since90)
        .order('entry_time', { ascending: true }),
      supabase.from('v_repeat_visitors')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('visit_count', { ascending: false })
        .limit(20),
      supabase.from('flag_alerts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('alerted_at', since90)
        .order('alerted_at', { ascending: false }),
      supabase.from('incidents')
        .select('id,type,severity,status,description,created_at,gates(name)')
        .eq('tenant_id', tenant.id)
        .gte('created_at', since90)
        .order('created_at', { ascending: false })
    ])`
)

// Add flagAlerts and incidents to variables after fetch
intelContent = intelContent.replace(
  `const movements = movRes.data || []
    const repeatVisitors = repRes.data || []`,
  `const movements = movRes.data || []
    const repeatVisitors = repRes.data || []
    const flagAlerts = flagRes.data || []
    const incidents = incRes.data || []`
)

// Add flag alert anomalies before the "if anomalies.length === 0" check
intelContent = intelContent.replace(
  `if (anomalies.length === 0) {
      anomalies.push({
        level: 'ok',
        title: 'No significant anomalies detected',
        body: 'Movement patterns are within normal parameters for the analysis period.'
      })
    }`,
  `// Flag alert anomalies
    const unacknowledged = flagAlerts.filter(f => !f.acknowledged)
    if (flagAlerts.length > 0) {
      anomalies.unshift({
        level: unacknowledged.length > 0 ? 'critical' : 'warning',
        title: flagAlerts.length + ' watchlist hit' + (flagAlerts.length === 1 ? '' : 's') + ' in this period' + (unacknowledged.length > 0 ? ' — ' + unacknowledged.length + ' unacknowledged' : ' — all acknowledged'),
        body: 'Flagged vehicles or persons were detected attempting entry. Review the Alerts tab for full details.',
        meta: 'Most recent: ' + new Date(flagAlerts[0].alerted_at).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      })
    }

    // Incident anomalies
    const openInc = incidents.filter(i => i.status === 'open')
    const criticalInc = incidents.filter(i => i.severity === 'critical')
    if (incidents.length > 0) {
      anomalies.unshift({
        level: criticalInc.length > 0 ? 'critical' : openInc.length > 0 ? 'warning' : 'info',
        title: incidents.length + ' incident' + (incidents.length === 1 ? '' : 's') + ' reported' + (openInc.length > 0 ? ' — ' + openInc.length + ' still open' : ' — all resolved or acknowledged'),
        body: criticalInc.length > 0 ? criticalInc.length + ' critical incident(s) recorded in this period. Immediate review required.' : 'Incidents have been logged by gate officers. Review the Incidents tab for full details.',
        meta: 'Most recent: ' + new Date(incidents[0].created_at).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      })
    }

    if (anomalies.length === 0) {
      anomalies.push({
        level: 'ok',
        title: 'No significant anomalies detected',
        body: 'Movement patterns are within normal parameters for the analysis period.'
      })
    }`
)

// Pass flagAlerts and incidents into setIntel
intelContent = intelContent.replace(
  `setIntel({
      empty: false,
      anomalies,`,
  `setIntel({
      empty: false,
      anomalies,
      flagAlerts,
      incidents,`
)

// Add flag alerts and incidents sections to the PDF generator
// Find the generateBriefHTML function and add sections before the closing </div> of main content
const flagAndIncSection = `
  // Flag alerts section for PDF
  const flagSection = intel.flagAlerts && intel.flagAlerts.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Watchlist Alerts
    </h2>
    <div style="margin-bottom:36px;">
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
        <strong>\${intel.flagAlerts.length} flag alert(s)</strong> were triggered in this period.
        \${intel.flagAlerts.filter(f => !f.acknowledged).length > 0 ? '<strong style="color:#c0132a;">' + intel.flagAlerts.filter(f => !f.acknowledged).length + ' remain unacknowledged.</strong>' : 'All have been acknowledged.'}
      </p>
    </div>
  \` : '<p style="font-size:13px;color:#6b7280;margin-bottom:36px;">No watchlist alerts in this period.</p>'

  const incSection = intel.incidents && intel.incidents.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Incidents Summary
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Type</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Severity</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Status</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Date</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Gate</th>
      </tr></thead>
      <tbody>
        \${intel.incidents.map(inc => \`
          <tr>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">\${inc.type.replace(/_/g,' ')}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;color:\${inc.severity === 'critical' ? '#c0132a' : inc.severity === 'serious' ? '#92530a' : '#1a56db'};font-weight:600;">\${inc.severity}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">\${inc.status}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">\${new Date(inc.created_at).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">\${inc.gates?.name || '—'}</td>
          </tr>
        \`).join('')}
      </tbody>
    </table>
  \` : ''`

// Insert these computed vars into generateBriefHTML, just before the return statement
intelContent = intelContent.replace(
  `  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SENTRi Intelligence Brief`,
  flagAndIncSection + `\n\n  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SENTRi Intelligence Brief`
)

// Add the sections into the PDF body before the footer
intelContent = intelContent.replace(
  `  <!-- Footer -->
  <div style="padding:20px 48px;border-top:1px solid #e2e6ed`,
  `  <!-- Flag alerts -->
  \${flagSection}
  <!-- Incidents -->
  \${incSection}

  <!-- Footer -->
  <div style="padding:20px 48px;border-top:1px solid #e2e6ed`
)

fs.writeFileSync(intelPath, intelContent, 'utf8')
console.log('✓ IntelligenceTab.jsx enriched with flag alerts and incidents')

// ── 3. Enrich ReportTab PDF with flag alerts and incidents ──
const reportPath = path.join(process.cwd(), 'src', 'pages', 'command', 'ReportTab.jsx')
let reportContent = fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '')

// Add flag_alerts fetch to fetchReport
reportContent = reportContent.replace(
  `const [movRes, incRes, repRes, prevMovRes, prevIncRes] = await Promise.all([`,
  `const [movRes, incRes, repRes, prevMovRes, prevIncRes, flagRes] = await Promise.all([`
)

reportContent = reportContent.replace(
  `supabase.from('incidents').select('id,severity').eq('tenant_id', tenant.id).gte('created_at', prevSince).lt('created_at', since),
    ])`,
  `supabase.from('incidents').select('id,severity').eq('tenant_id', tenant.id).gte('created_at', prevSince).lt('created_at', since),
      supabase.from('flag_alerts').select('id,acknowledged,alerted_at').eq('tenant_id', tenant.id).gte('alerted_at', since).order('alerted_at', { ascending: false }),
    ])`
)

// Add flagAlerts to setData
reportContent = reportContent.replace(
  `repeatVisitors: repRes.data || []
    })`,
  `repeatVisitors: repRes.data || [],
      flagAlerts: flagRes.data || [],
      flagTotal: (flagRes.data || []).length,
      flagUnack: (flagRes.data || []).filter(f => !f.acknowledged).length,
    })`
)

// Add flag alerts and incidents to PDF generateReportHTML — after repeatRows definition
reportContent = reportContent.replace(
  `  return \`<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>SENTRi Intelligence Report`,
  `  // Flag alerts summary for PDF
  const flagSummaryHTML = data.flagTotal > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Watchlist Alerts</h2>
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:36px;">
      <div style="font-size:24px;font-weight:700;color:#c0132a;margin-bottom:4px;">\${data.flagTotal}</div>
      <div style="font-size:12px;color:#6b7280;">Flag alert(s) triggered in this period\${data.flagUnack > 0 ? ' — <strong style=\\"color:#c0132a;\\">' + data.flagUnack + ' unacknowledged</strong>' : ' — all acknowledged'}</div>
    </div>
  \` : \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Watchlist Alerts</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:36px;">No watchlist alerts in this period.</p>
  \`

  const incSummaryHTML = data.incidents > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Incident Summary</h2>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:36px;display:flex;gap:24px;">
      <div><div style="font-size:24px;font-weight:700;color:#92530a;">\${data.incidents}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Total</div></div>
      <div><div style="font-size:24px;font-weight:700;color:#c0132a;">\${data.criticalIncidents}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Critical</div></div>
    </div>
  \` : \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Incident Summary</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:36px;">No incidents reported in this period.</p>
  \`

  return \`<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>SENTRi Intelligence Report`
)

// Insert flag and incident HTML into PDF body before footer
reportContent = reportContent.replace(
  `  <!-- Footer -->
  <div style="padding:18px 48px;border-top:1px solid #e2e6ed`,
  `  <!-- Flags and incidents -->
  \${flagSummaryHTML}
  \${incSummaryHTML}

  <!-- Footer -->
  <div style="padding:18px 48px;border-top:1px solid #e2e6ed`
)

fs.writeFileSync(reportPath, reportContent, 'utf8')
console.log('✓ ReportTab.jsx enriched with flag alerts and incidents in PDF')

// ── Git ──
try {
  execSync('git add src/pages/command/CommandApp.jsx src/pages/command/IntelligenceTab.jsx src/pages/command/ReportTab.jsx', { stdio: 'inherit' })
  execSync('git commit -m "Fix: Intelligence tab last in nav, enrich both PDFs with flag alerts and incidents"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nDone. Intelligence is now last in nav. Both PDFs include flag alerts and incidents.')
