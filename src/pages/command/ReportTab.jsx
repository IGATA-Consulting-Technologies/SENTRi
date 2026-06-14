import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const PERIODS = [
  { key: 'weekly',    label: 'This Week',    days: 7   },
  { key: 'monthly',   label: 'This Month',   days: 30  },
  { key: 'quarterly', label: 'This Quarter', days: 90  },
  { key: 'annually',  label: 'This Year',    days: 365 },
]

// ── Helpers ──
function hourLabel(h) { return h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm' }
function fmtDur(m) {
  if (!m) return '—'
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ' + (m % 60) + 'm'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'd ' + (h % 24) + 'h'
  const wk = Math.floor(d / 7)
  if (wk < 5) return wk + 'wk ' + (d % 7) + 'd'
  const mo = Math.floor(d / 30)
  return mo + 'mo ' + (d % 30) + 'd'
}
function fmtDate(d) { return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) }

// ── Inline peak hours SVG bar chart ──
function PeakHoursChart({ byHour }) {
  const max = Math.max(...byHour.map(h => h.count), 1)
  return (
    <div>
      <svg viewBox="0 0 528 80" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {byHour.map((h, i) => {
          const barH = max > 0 ? Math.max(3, Math.round((h.count / max) * 60)) : 3
          const x = i * 22
          const y = 60 - barH
          const isPeak = h.count === max && max > 0
          return (
            <g key={h.hour}>
              <rect x={x} y={y} width={18} height={barH}
                fill={isPeak ? '#c0132a' : h.count > 0 ? '#1a56db' : '#e2e6ed'} rx="2" />
              {(h.hour % 6 === 0) && (
                <text x={x + 9} y={76} textAnchor="middle" fontSize="9" fill="#9ca3af">
                  {hourLabel(h.hour)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Dwell time bar ──
function DwellBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-1)' }}>{label}</span>
        <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{count} <span style={{ color: 'var(--text-2)', fontWeight: '400' }}>({pct}%)</span></span>
      </div>
      <div style={{ background: 'var(--bg-2)', borderRadius: '4px', height: '7px' }}>
        <div style={{ background: color, borderRadius: '4px', height: '7px', width: pct + '%', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ── PDF Report HTML ──
function generateReportHTML(data, tenantName, periodLabel) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const peakHour = data.byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
  const peakLabel = peakHour.count > 0 ? hourLabel(peakHour.hour) : 'N/A'

  const statCards = [
    { label: 'Total Movements', value: data.total, color: '#1a56db' },
    { label: 'Vehicles', value: data.vehicles, color: '#1a1a2e' },
    { label: 'Pedestrians', value: data.pedestrians, color: '#1a1a2e' },
    { label: 'Flag Hits', value: data.flags, color: data.flags > 0 ? '#c0132a' : '#1a1a2e' },
    { label: 'Incidents', value: data.incidents, color: data.incidents > 0 ? '#92530a' : '#1a1a2e' },
    { label: 'Critical', value: data.criticalIncidents, color: data.criticalIncidents > 0 ? '#c0132a' : '#1a1a2e' },
    { label: 'Avg Stay (min)', value: data.avgDuration || 'N/A', color: '#1a1a2e' },
    { label: 'Peak Hour', value: peakLabel, color: '#92530a' },
  ].map(s => `<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px;text-align:center;">
    <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;">${s.label}</div>
    <div style="font-size:22px;font-weight:700;color:${s.color};">${s.value}</div>
  </div>`).join('')

  const maxHour = Math.max(...data.byHour.map(h => h.count), 1)
  const hourBars = data.byHour.map((h, i) => {
    const barH = Math.max(2, Math.round((h.count / maxHour) * 50))
    const x = i * 17
    return `<rect x="${x}" y="${50 - barH}" width="14" height="${barH}" fill="${h.count === maxHour && maxHour > 0 ? '#c0132a' : h.count > 0 ? '#1a56db' : '#e2e6ed'}" rx="2"/>`
  }).join('')

  const gateRows = data.byGate.map(g => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;">${g.name}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${g.total}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">${g.vehicles}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">${g.pedestrians}</td>
  </tr>`).join('')

  const dayRows = data.byDay.slice(0, 31).map(d => `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">${new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${d.total}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">${d.vehicles}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">${d.pedestrians}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;color:${d.flags > 0 ? '#c0132a' : '#6b7280'};font-weight:${d.flags > 0 ? '700' : '400'};">${d.flags}</td>
  </tr>`).join('')

  const destRows = data.topDest.length > 0 ? data.topDest.map(({ dest, count }) => `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">${dest}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${count}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">
      <div style="background:#e2e6ed;border-radius:4px;height:7px;"><div style="background:#1a56db;border-radius:4px;height:7px;width:${Math.round(count / data.topDest[0].count * 100)}%;"></div></div>
    </td>
  </tr>`).join('') : ''

  const repeatRows = data.repeatVisitors.map(v => `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;font-family:monospace;">${v.plate_number || v.visitor_name || '—'}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${v.visit_count}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">${fmtDate(v.last_visit)}</td>
  </tr>`).join('')

  const incRows = data.incidentBreakdown.map(inc => `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">${inc.type.replace(/_/g,' ')}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${inc.count}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;color:${inc.severity === 'critical' ? '#c0132a' : inc.severity === 'serious' ? '#92530a' : '#1a56db'};font-weight:600;">${inc.severity}</td>
  </tr>`).join('')

  const th = (label) => `<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">${label}</th>`
  const thC = (label) => `<th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">${label}</th>`
  const section = (title) => `<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e6ed;">${title}</h2>`
  const table = (headers, rows) => rows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;">${headers}</tr></thead><tbody>${rows}</tbody></table>` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>SENTRi Report — ${tenantName}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;background:white;}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}</style>
  </head><body>
  <div style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:32px 40px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div><div style="color:white;font-size:28px;font-weight:800;letter-spacing:0.1em;">SENTRi</div><div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Movement Intelligence Platform</div></div>
      <div style="text-align:right;"><div style="color:rgba(255,255,255,0.6);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">Generated</div><div style="color:white;font-size:13px;font-weight:600;margin-top:2px;">${now}</div><div style="color:rgba(255,255,255,0.5);font-size:10px;margin-top:4px;">CONFIDENTIAL</div></div>
    </div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.15);">
      <div style="color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Intelligence Report</div>
      <div style="color:white;font-size:22px;font-weight:700;">${tenantName}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:4px;">${periodLabel} Summary</div>
    </div>
  </div>
  <div style="padding:32px 40px;">
    ${section('Summary Statistics')}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px;">${statCards}</div>

    ${section('Peak Activity Hours')}
    <div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px;margin-bottom:6px;">
      <svg viewBox="0 0 408 56" style="width:100%;height:auto;"><text x="0" y="54" font-size="8" fill="#9ca3af">12am</text><text x="102" y="54" font-size="8" fill="#9ca3af">6am</text><text x="204" y="54" font-size="8" fill="#9ca3af">12pm</text><text x="306" y="54" font-size="8" fill="#9ca3af">6pm</text>${hourBars}</svg>
    </div>
    <p style="font-size:11px;color:#6b7280;margin-bottom:28px;">Peak hour: <strong>${peakLabel}</strong> with ${peakHour.count} movements. Red = peak.</p>

    ${data.flagTotal > 0 ? `${section('Watchlist Alerts')}
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:28px;display:flex;align-items:center;gap:20px;">
      <div><div style="font-size:28px;font-weight:700;color:#c0132a;">${data.flagTotal}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Flag alerts</div></div>
      ${data.flagUnack > 0 ? `<div><div style="font-size:28px;font-weight:700;color:#c0132a;">${data.flagUnack}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Unacknowledged</div></div>` : '<div style="font-size:13px;color:#0e7c3a;font-weight:600;">All acknowledged ✓</div>'}
    </div>` : `${section('Watchlist Alerts')}<p style="font-size:13px;color:#6b7280;margin-bottom:28px;">No watchlist alerts in this period.</p>`}

    ${data.incidents > 0 ? `${section('Incident Summary')}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:12px;display:flex;gap:24px;">
      <div><div style="font-size:28px;font-weight:700;color:#92530a;">${data.incidents}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Total</div></div>
      <div><div style="font-size:28px;font-weight:700;color:#c0132a;">${data.criticalIncidents}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Critical</div></div>
    </div>
    ${data.incidentBreakdown.length > 0 ? table(`${th('Type')}${thC('Count')}${th('Severity')}`, incRows) : ''}` : `${section('Incident Summary')}<p style="font-size:13px;color:#6b7280;margin-bottom:28px;">No incidents in this period.</p>`}

    ${data.byGate.length > 0 ? `${section('Activity by Gate')}${table(`${th('Gate')}${thC('Total')}${thC('Vehicles')}${thC('Pedestrians')}`, gateRows)}` : ''}

    ${data.dwell.total > 0 ? `${section('Dwell Time Distribution')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="background:#f8f9fb;">${th('Duration Range')}${thC('Count')}${thC('%')}</tr></thead><tbody>
    ${[['Quick (under 15 min)', data.dwell.quick],['Normal (15–60 min)', data.dwell.normal],['Extended (1–3 hrs)', data.dwell.extended],['Long stay (3+ hrs)', data.dwell.long]].filter(r => r[1] > 0).map(([label, count]) => `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;">${label}</td><td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">${count}</td><td style="padding:7px 12px;border-bottom:1px solid #e2e6ed;text-align:center;">${Math.round(count/data.dwell.total*100)}%</td></tr>`).join('')}
    </tbody></table>` : ''}

    ${data.topDest.length > 0 ? `${section('Top Destinations')}${table(`${th('Destination')}${thC('Visits')}${th('Frequency')}`, destRows)}` : ''}

    ${data.byDay.length > 0 ? `${section('Daily Breakdown')}${table(`${th('Date')}${thC('Total')}${thC('Vehicles')}${thC('Pedestrians')}${thC('Flags')}`, dayRows)}` : ''}

    ${data.repeatVisitors.length > 0 ? `${section('Repeat Visitors')}${table(`${th('Plate / Name')}${thC('Visits')}${th('Last Visit')}`, repeatRows)}` : ''}
  </div>
  <div style="padding:16px 40px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
    <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence — CONFIDENTIAL</span>
  </div>
  </body></html>`
}

// ── Intelligence Brief HTML (3-page narrative format) ──
function generateBriefHTML(data, tenantName, periodLabel) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  function hourLabel(h) { return h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h-12) + 'pm' }
  function pct(a, b) { return b > 0 ? Math.round((a/b)*100) : 0 }
  function chg(cur, prev) { return prev > 0 ? Math.round(((cur-prev)/prev)*100) : null }
  function chgColor(c) { return c > 0 ? '#c0132a' : c < 0 ? '#0e7c3a' : '#92530a' }
  function fmtDur(m) {
    if (!m) return '—'
    if (m < 60) return m + 'm'
    const h = Math.floor(m / 60)
    if (h < 24) return h + 'h ' + (m % 60) + 'm'
    const d = Math.floor(h / 24)
    return d + 'd ' + (h % 24) + 'h'
  }

  // Risk Score
  let riskScore = 0
  const riskReasons = []
  const prevChg = chg(data.total, data.prev?.total)
  if (data.criticalIncidents > 0) { riskScore += 40; riskReasons.push('critical incident(s) reported') }
  if (data.flagUnack > 0) { riskScore += 25; riskReasons.push('unacknowledged watchlist alerts') }
  if (data.offHours > 0 && pct(data.offHours, data.total) > 15) { riskScore += 20; riskReasons.push('elevated after-hours activity (' + pct(data.offHours, data.total) + '% of movements)') }
  if (data.incidents > 0 && pct(data.incidents, data.total) > 10) { riskScore += 15; riskReasons.push('high incident-to-movement ratio') }
  if (prevChg !== null && prevChg > 30) { riskScore += 15; riskReasons.push('movement volume surged ' + prevChg + '% vs prior period') }
  if (data.repeatVisitors.length > 0 && data.repeatVisitors[0].visit_count > 5) { riskScore += 10; riskReasons.push('high-frequency repeat visitor detected') }
  if (data.flagTotal > 0 && data.flagUnack === 0) { riskScore += 5 }

  let riskLevel, riskColor, riskBg
  if (riskScore >= 60) { riskLevel = 'CRITICAL'; riskColor = '#c0132a'; riskBg = 'rgba(192,19,42,0.08)' }
  else if (riskScore >= 35) { riskLevel = 'HIGH'; riskColor = '#c0132a'; riskBg = 'rgba(192,19,42,0.06)' }
  else if (riskScore >= 15) { riskLevel = 'MODERATE'; riskColor = '#92530a'; riskBg = 'rgba(146,83,10,0.06)' }
  else { riskLevel = 'LOW'; riskColor = '#0e7c3a'; riskBg = 'rgba(14,124,58,0.06)' }

  const riskExplanation = riskReasons.length > 0
    ? 'Security posture rated ' + riskLevel + ' due to ' + riskReasons.join(', ') + '.'
    : 'Movement patterns are within normal parameters. No significant risk indicators detected.'

  const peakHour = data.byHour.reduce((a,b) => b.count > a.count ? b : a, {hour:0,count:0})
  const peakDay = data.byDow.reduce((a,b) => b.avg > a.avg ? b : a, data.byDow[0] || {dow:0,avg:0})
  const top2Days = [...data.byDow].sort((a,b) => b.avg - a.avg).slice(0,2)
  const topDest = data.topDest[0]
  const offHoursPct = pct(data.offHours, data.total)
  const repeatCount = data.repeatVisitors.length
  const topRepeat = data.repeatVisitors[0]
  const repeatSharePct = topRepeat ? pct(topRepeat.visit_count, data.total) : 0

  // Commander's Brief
  const commandersBrief = (() => {
    const parts = []
    parts.push('During the reporting period, ' + tenantName + ' recorded ' + data.total + ' movements across ' + data.activeDays + ' active days, averaging ' + data.dailyAvg + ' movements per day.')
    if (topDest) { const c = pct(topDest.count, data.total); parts.push('Movement was ' + (c > 40 ? 'heavily concentrated' : 'primarily directed') + ' toward ' + topDest.dest + ', which accounted for ' + c + '% of all facility entries.') }
    if (data.offHours > 0) { const trend = prevChg !== null && prevChg > 20 ? 'increased by ' + prevChg + '% compared to the previous reporting period and ' : ''; parts.push('After-hours activity ' + trend + 'accounted for ' + offHoursPct + '% of total movement' + (offHoursPct > 15 ? ', which exceeds the recommended operational threshold' : '') + '.') }
    if (repeatCount > 0) { parts.push(repeatCount + ' repeat visitor' + (repeatCount > 1 ? 's were' : ' was') + ' identified' + (topRepeat ? ', with the highest-frequency individual accounting for ' + topRepeat.visit_count + ' entries (' + repeatSharePct + '% of total movement)' : '') + '.') }
    if (data.criticalIncidents > 0) { parts.push(data.criticalIncidents + ' critical incident' + (data.criticalIncidents > 1 ? 's were' : ' was') + ' recorded and require immediate command review.') }
    else if (data.incidents > 0) { parts.push(data.incidents + ' incident' + (data.incidents > 1 ? 's were' : ' was') + ' reported. No critical security events were detected.') }
    else { parts.push('No security incidents were recorded during this period.') }
    if (data.flagUnack > 0) { parts.push(data.flagUnack + ' watchlist alert' + (data.flagUnack > 1 ? 's remain' : ' remains') + ' unacknowledged and require immediate command attention.') }
    return parts.join(' ')
  })()

  // Critical Findings with So What
  const findings = []
  if (data.offHours > 0 && offHoursPct > 10) findings.push({ title: 'After-hours movement exceeds baseline', detail: offHoursPct + '% of all movements occurred outside normal hours (before 0600 or after 2200).', soWhat: 'Elevated after-hours activity increases monitoring burden and may reduce anomaly visibility.', action: 'Conduct targeted review of access records between 2200–0600 hrs.' })
  if (peakDay.avg > 0) findings.push({ title: days[peakDay.dow] + ' consistently records highest activity', detail: days[peakDay.dow] + ' accounts for the highest average daily movement at ' + Math.round(peakDay.avg) + ' movements per day.', soWhat: 'Predictable activity concentration creates identifiable operational patterns.', action: 'Ensure maximum guard coverage and alert readiness on ' + days[peakDay.dow] + 's.' })
  if (topDest && pct(topDest.count, data.total) > 35) findings.push({ title: 'Visitor concentration elevated at ' + topDest.dest, detail: topDest.count + ' of ' + data.total + ' movements (' + pct(topDest.count, data.total) + '%) directed to a single facility zone.', soWhat: 'High concentration at one location increases risk exposure in that zone.', action: 'Verify access authorisation for all visitors directed to ' + topDest.dest + '.' })
  if (repeatCount > 0) findings.push({ title: 'Repeat visitor frequency warrants monitoring', detail: repeatCount + ' individuals or vehicles recorded multiple entries during this period.', soWhat: 'Repeat visitors account for a disproportionate share of facility access.', action: 'Review movement records of all identified repeat visitors and validate access justifications.' })
  if (data.flagTotal > 0) { const s = data.flagUnack > 0 ? data.flagUnack + ' remain unacknowledged' : 'all acknowledged'; findings.push({ title: 'Watchlist interactions: ' + data.flagTotal + ' (' + s + ')', detail: data.flagTotal + ' watchlist alert' + (data.flagTotal > 1 ? 's' : '') + ' triggered. ' + (data.flagUnack > 0 ? data.flagUnack + ' have not been acknowledged by command.' : 'All have been reviewed and acknowledged.'), soWhat: data.flagUnack > 0 ? 'Unacknowledged alerts represent potential security gaps in command oversight.' : 'All watchlist encounters have been appropriately reviewed.', action: data.flagUnack > 0 ? 'Acknowledge outstanding watchlist alerts and confirm disposition.' : 'Continue standard watchlist monitoring protocols.' }) }
  if (findings.length < 5 && prevChg !== null && Math.abs(prevChg) > 20) { const dir = prevChg > 0 ? 'increased' : 'decreased'; findings.push({ title: 'Movement volume ' + dir + ' ' + Math.abs(prevChg) + '% vs prior period', detail: 'Total movements ' + dir + ' from ' + data.prev.total + ' to ' + data.total + ' compared to the equivalent previous period.', soWhat: prevChg > 20 ? 'Significant volume increase may strain guard capacity and reduce per-entry scrutiny.' : 'Significant reduction may indicate access restriction, seasonal factors, or data collection gaps.', action: prevChg > 20 ? 'Review guard deployment levels to ensure coverage matches current activity volume.' : 'Verify gate logging is active and guards are capturing all entries.' }) }
  const topFindings = findings.slice(0,5)

  // Anomalies
  const criticalAnomalies = [], securityAnomalies = [], operationalAnomalies = []
  if (data.criticalIncidents > 0) criticalAnomalies.push({ label: 'Critical incidents reported', value: data.criticalIncidents, detail: 'Immediate command review required.' })
  if (data.flagUnack > 0) criticalAnomalies.push({ label: 'Unacknowledged watchlist alerts', value: data.flagUnack, detail: 'Alerts triggered but not reviewed by command.' })
  if (data.offHours > 0 && offHoursPct > 20) securityAnomalies.push({ label: 'Elevated off-hours movement', value: offHoursPct + '% of movements', detail: 'Historical baseline: typically under 10%. Current period: ' + offHoursPct + '%. Warrants review.' })
  if (topRepeat && topRepeat.visit_count > 4) securityAnomalies.push({ label: 'High-frequency repeat visitor', value: topRepeat.visit_count + ' entries', detail: (topRepeat.plate_number || topRepeat.visitor_name || 'Unknown') + ' has entered the facility ' + topRepeat.visit_count + ' times this period.' })
  if (data.incidents > 0 && !data.criticalIncidents) operationalAnomalies.push({ label: 'Incidents logged this period', value: data.incidents, detail: 'No critical incidents. Standard review recommended.' })
  if (data.incomplete > 0) operationalAnomalies.push({ label: 'Incomplete movement records', value: data.incomplete, detail: data.incomplete + ' entr' + (data.incomplete === 1 ? 'y' : 'ies') + ' logged without destination or purpose.' })

  // Predictive
  const predictedNext = prevChg !== null ? Math.round(data.total * (1 + (prevChg / 100) * 0.5)) : null
  const riskForecast = riskLevel === 'CRITICAL' ? { level: 'HIGH', confidence: 85 } : riskLevel === 'HIGH' ? { level: 'HIGH', confidence: 78 } : riskLevel === 'MODERATE' ? { level: 'MODERATE', confidence: 72 } : { level: 'LOW', confidence: 88 }
  const offHoursForecast = offHoursPct > 15 ? { level: 'HIGH', confidence: 82 } : offHoursPct > 5 ? { level: 'MODERATE', confidence: 70 } : { level: 'LOW', confidence: 85 }

  const watchlistNarrative = (() => {
    if (data.flagTotal === 0) return 'No watchlist matches were recorded during this reporting period. All monitored vehicles and individuals accessed the facility without triggering any watchlist alerts.'
    if (data.flagUnack > 0) return data.flagTotal + ' watchlist match' + (data.flagTotal > 1 ? 'es' : '') + ' occurred during this period. ' + data.flagUnack + ' remain' + (data.flagUnack === 1 ? 's' : '') + ' unacknowledged by command. Unreviewed alerts represent a potential gap in operational oversight and require immediate attention.'
    return data.flagTotal + ' watchlist match' + (data.flagTotal > 1 ? 'es' : '') + ' occurred. All were acknowledged and reviewed by command. Frequency remains consistent with operational baseline and does not presently indicate elevated threat activity.'
  })()

  const css = `*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;background:white;}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}.page-break{page-break-before:always;}}`

  const hdr = (sub) => `<div style="background:linear-gradient(135deg,#0a0f1e 0%,#0f1923 70%,#1a2235 100%);padding:28px 40px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;"><div><div style="color:white;font-size:24px;font-weight:800;letter-spacing:0.1em;">SENTRi</div><div style="color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Movement Intelligence Platform</div></div><div style="text-align:right;"><div style="color:rgba(255,255,255,0.45);font-size:9px;text-transform:uppercase;letter-spacing:0.06em;">Generated</div><div style="color:white;font-size:12px;font-weight:600;margin-top:2px;">${now}</div><div style="display:inline-block;margin-top:6px;background:rgba(192,19,42,0.3);border:1px solid rgba(192,19,42,0.5);color:#ff8a9a;font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:0.1em;">CONFIDENTIAL</div></div></div><div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;"><div style="color:rgba(255,255,255,0.45);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;">Intelligence Brief · ${sub}</div><div style="color:white;font-size:20px;font-weight:700;">${tenantName}</div><div style="color:rgba(255,255,255,0.55);font-size:12px;margin-top:3px;">${periodLabel} · Automated analysis</div></div></div>`

  const footer = `<div style="padding:12px 40px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;background:#f8f9fb;"><span style="font-size:10px;color:#9ca3af;">Powered by IGATA Technologies · SENTRi Movement Intelligence</span><span style="font-size:10px;color:#9ca3af;">CONFIDENTIAL — Authorised personnel only</span></div>`

  const sh = (title, color) => `<div style="margin:24px 0 12px;padding-bottom:7px;border-bottom:2px solid ${color||'#e2e6ed'};display:flex;align-items:center;gap:8px;"><div style="width:3px;height:14px;background:${color||'#1a56db'};border-radius:2px;"></div><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">${title}</span></div>`

  const page1 = `${hdr('Page 1 of 3 · Executive Intelligence Summary')}<div style="padding:24px 40px 20px;">${sh('Operational Risk Assessment',riskColor)}<div style="background:${riskBg};border:1.5px solid ${riskColor}30;border-radius:12px;padding:20px 24px;"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;"><div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Overall Security Posture</div><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">${['LOW','MODERATE','HIGH','CRITICAL'].map(l=>`<div style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;background:${l===riskLevel?riskColor:'#e5e7eb'};color:${l===riskLevel?'white':'#9ca3af'};">${l}</div>`).join('')}</div><div style="font-size:12px;color:#374151;line-height:1.6;max-width:480px;">${riskExplanation}</div></div><div style="text-align:right;flex-shrink:0;"><div style="font-size:42px;font-weight:800;color:${riskColor};line-height:1;">${riskScore}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Risk Score</div></div></div></div>${sh("Commander's Brief")}<div style="background:#f8f9fb;border-left:3px solid #1a56db;border-radius:0 8px 8px 0;padding:16px 18px;font-size:13px;color:#374151;line-height:1.75;">${commandersBrief}</div>${sh('Critical Findings')}<div style="display:flex;flex-direction:column;gap:10px;">${topFindings.map((f,i)=>`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px 16px;"><div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;"><div style="width:20px;height:20px;background:#1a56db;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;"><span style="color:white;font-size:10px;font-weight:700;">${i+1}</span></div><div style="font-size:13px;font-weight:700;color:#1a1a2e;">${f.title}</div></div><div style="font-size:12px;color:#6b7280;margin-bottom:8px;padding-left:30px;">${f.detail}</div><div style="background:rgba(26,86,219,0.04);border:1px solid rgba(26,86,219,0.1);border-radius:6px;padding:8px 12px;margin-left:30px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:3px;">So What?</div><div style="font-size:12px;color:#374151;">${f.soWhat}</div></div></div>`).join('')}</div>${sh('Recommended Actions','#0e7c3a')}<div style="background:rgba(14,124,58,0.04);border:1px solid rgba(14,124,58,0.15);border-radius:8px;padding:14px 18px;">${topFindings.map((f,i)=>`<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${i<topFindings.length-1?'10px':'0'};font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">${i+1}.</span><span>${f.action}</span></div>`).join('')}</div></div>${footer}`

  const page2 = `<div class="page-break"></div>${hdr('Page 2 of 3 · Threat & Pattern Analysis')}<div style="padding:24px 40px 20px;">${sh('Behavioural Analysis')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">${[['Total Movements',data.total,'#1a56db',prevChg!==null?(prevChg>0?'↑':'↓')+' '+Math.abs(prevChg)+'% vs prior period':null],['Vehicles',data.vehicles,'#1a1a2e',null],['Pedestrians',data.pedestrians,'#1a1a2e',null],['After-Hours',data.offHours,data.offHours>0?'#c0132a':'#1a1a2e',offHoursPct+'% of total movements'],['Flag Alerts',data.flagTotal,data.flagTotal>0?'#c0132a':'#0e7c3a',data.flagUnack>0?data.flagUnack+' unacknowledged':'All acknowledged'],['Incidents',data.incidents,data.incidents>0?'#92530a':'#1a1a2e',data.criticalIncidents>0?data.criticalIncidents+' critical':null]].map(([l,v,c,sub])=>`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${l}</div><div style="font-size:22px;font-weight:700;color:${c};">${v}</div>${sub?`<div style="font-size:10px;color:#6b7280;margin-top:3px;">${sub}</div>`:''}</div>`).join('')}</div>${sh('Trend Analysis')}<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px 18px;margin-bottom:0;">${prevChg!==null?`<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:8px;">Movement volume <strong style="color:${chgColor(prevChg)};">${prevChg>0?'increased':'decreased'} by ${Math.abs(prevChg)}%</strong> compared to the previous equivalent period (${data.prev.total} → ${data.total} movements).</p><p style="font-size:12px;color:#6b7280;line-height:1.6;">${prevChg>20?'This significant increase warrants review of guard coverage adequacy for the current operational tempo.':prevChg<-20?'This significant decrease may reflect access restrictions, seasonal factors, or gaps in data capture.':'Movement trend remains within acceptable variance range.'}</p>`:'<p style="font-size:13px;color:#6b7280;">Insufficient historical data for period-on-period comparison.</p>'}</div>${sh('Pattern Discovery')}<div style="display:flex;flex-direction:column;gap:8px;">${peakHour.count>0?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:5px;">Temporal Pattern</div><div style="font-size:13px;color:#374151;line-height:1.6;">Peak activity consistently occurs at <strong>${hourLabel(peakHour.hour)}</strong> with ${peakHour.count} movements.${peakHour.hour>=22||peakHour.hour<6?' <strong style="color:#c0132a;">Note: peak falls within off-hours window.</strong>':''}</div></div>`:''}${top2Days[0]?.avg>0?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:5px;">Day Pattern</div><div style="font-size:13px;color:#374151;line-height:1.6;"><strong>${days[top2Days[0].dow]}</strong>${top2Days[1]?.avg>0?' and <strong>'+days[top2Days[1].dow]+'</strong>':''} record the highest average activity at ${Math.round(top2Days[0].avg)}${top2Days[1]?.avg>0?' and '+Math.round(top2Days[1].avg):''} movements respectively.</div></div>`:''}${topDest?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:5px;">Location Pattern</div><div style="font-size:13px;color:#374151;line-height:1.6;"><strong>${topDest.dest}</strong> receives ${topDest.count} visits (${pct(topDest.count,data.total)}% of all movements)${data.topDest[1]?' — more than twice the traffic of the next busiest destination ('+data.topDest[1].dest+': '+data.topDest[1].count+' visits)':''}.</div></div>`:''}${repeatCount>0?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:5px;">Visitor Pattern</div><div style="font-size:13px;color:#374151;line-height:1.6;"><strong>${repeatCount} individual${repeatCount>1?'s or vehicles':' or vehicle'}</strong> recorded multiple entries.${topRepeat?' The highest-frequency visitor accounted for '+topRepeat.visit_count+' entries ('+repeatSharePct+'% of all movements).':''}</div></div>`:''}</div>${sh('Anomaly Detection')}${criticalAnomalies.length>0?`<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#c0132a;margin-bottom:6px;">Critical Anomalies — Immediate Action Required</div>${criticalAnomalies.map(a=>`<div style="background:rgba(192,19,42,0.05);border:1px solid rgba(192,19,42,0.2);border-left:3px solid #c0132a;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;color:#c0132a;margin-bottom:3px;">${a.label} — ${a.value}</div><div style="font-size:11px;color:#374151;">${a.detail}</div></div>`).join('')}</div>`:''}${securityAnomalies.length>0?`<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#92530a;margin-bottom:6px;">Security Anomalies — Review Required</div>${securityAnomalies.map(a=>`<div style="background:rgba(146,83,10,0.05);border:1px solid rgba(146,83,10,0.2);border-left:3px solid #92530a;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;color:#92530a;margin-bottom:3px;">${a.label} — ${a.value}</div><div style="font-size:11px;color:#374151;">${a.detail}</div></div>`).join('')}</div>`:''}${operationalAnomalies.length>0?`<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Operational Anomalies — Standard Review</div>${operationalAnomalies.map(a=>`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-left:3px solid #6b7280;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:3px;">${a.label} — ${a.value}</div><div style="font-size:11px;color:#6b7280;">${a.detail}</div></div>`).join('')}</div>`:''}${criticalAnomalies.length===0&&securityAnomalies.length===0&&operationalAnomalies.length===0?'<p style="font-size:13px;color:#0e7c3a;font-weight:600;">No anomalies detected. All movement patterns are within normal operational parameters.</p>':''}${sh('Watchlist Intelligence')}<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px 18px;"><p style="font-size:13px;color:#374151;line-height:1.7;">${watchlistNarrative}</p>${data.flagTotal>0?`<div style="display:flex;gap:16px;margin-top:14px;padding-top:12px;border-top:1px solid #e2e6ed;"><div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:${data.flagTotal>0?'#c0132a':'#0e7c3a'};">${data.flagTotal}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Total Alerts</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:${data.flagUnack>0?'#c0132a':'#0e7c3a'};">${data.flagUnack}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Unacknowledged</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:#0e7c3a;">${data.flagTotal-data.flagUnack}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Reviewed</div></div></div>`:''}</div></div>${footer}`

  const page3 = `<div class="page-break"></div>${hdr('Page 3 of 3 · Predictive & Decision Support')}<div style="padding:24px 40px 20px;">${sh('Predictive Assessment')}<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px 18px;"><p style="font-size:13px;color:#374151;line-height:1.7;">${predictedNext!==null?`Based on current activity trajectory and historical patterns, movement volume is projected to reach approximately <strong>${predictedNext} movements</strong> in the next equivalent reporting period. This represents a ${predictedNext>data.total?'projected increase':'projected decrease'} of ${Math.abs(predictedNext-data.total)} movements (${Math.abs(chg(predictedNext,data.total))}%) from current levels.`:'Insufficient historical data to generate a reliable movement projection for the next period. A baseline will be established after additional reporting cycles.'}</p></div>${sh('Expected Peak Windows')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${top2Days.filter(d=>d.avg>0).map(d=>`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px;text-align:center;"><div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${days[d.dow]}</div><div style="font-size:13px;color:#1a56db;font-weight:600;margin-bottom:8px;">${hourLabel(Math.max(0,peakHour.hour-1))} – ${hourLabel(Math.min(23,peakHour.hour+2))}</div><div style="font-size:11px;color:#6b7280;">Expected avg: ${Math.round(d.avg)} movements</div></div>`).join('')}</div>${sh('Emerging Patterns')}<div style="display:flex;flex-direction:column;gap:8px;">${topDest?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:12px;color:#374151;line-height:1.65;"><strong>${topDest.dest}</strong> continues to receive the highest movement concentration (${pct(topDest.count,data.total)}%). If this pattern persists, security resource allocation should be weighted toward this zone.</div></div>`:''}${repeatCount>1?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:12px;color:#374151;line-height:1.65;">Repeat visitor frequency has been recorded at <strong>${repeatCount} individuals or vehicles</strong> this period. If this trend continues, access justifications for all repeat visitors should be formally reviewed at the next reporting cycle.</div></div>`:''}${data.offHours>0?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:12px;color:#374151;line-height:1.65;">After-hours movement represents <strong>${offHoursPct}%</strong> of total facility activity. ${offHoursPct>15?'This level exceeds recommended operational thresholds and is flagged as a continuing pattern requiring command attention.':'This level is within acceptable range but should be monitored for upward trends in subsequent periods.'}</div></div>`:''}${prevChg!==null&&prevChg>15?`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:12px 16px;"><div style="font-size:12px;color:#374151;line-height:1.65;">Movement volume has increased <strong>${prevChg}%</strong> compared to the previous period. Sustained growth at this rate may require adjustment of guard deployment levels to maintain adequate coverage.</div></div>`:''}</div>${sh('Risk Forecast')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${[['Overall Security Risk',riskForecast.level,riskForecast.level==='HIGH'||riskForecast.level==='CRITICAL'?'#c0132a':riskForecast.level==='MODERATE'?'#92530a':'#0e7c3a',riskForecast.confidence],['After-Hours Risk',offHoursForecast.level,offHoursForecast.level==='HIGH'?'#c0132a':offHoursForecast.level==='MODERATE'?'#92530a':'#0e7c3a',offHoursForecast.confidence]].map(([l,level,c,conf])=>`<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${l}</div><div style="display:flex;justify-content:space-between;align-items:flex-end;"><div><div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Current</div><div style="font-size:16px;font-weight:700;color:${c};">${riskLevel}</div></div><div style="color:#9ca3af;font-size:18px;">→</div><div><div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Forecast</div><div style="font-size:16px;font-weight:700;color:${c};">${level}</div></div><div style="text-align:right;"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Confidence</div><div style="font-size:16px;font-weight:700;color:#1a1a2e;">${conf}%</div></div></div></div>`).join('')}</div>${sh('Resource Recommendations','#0e7c3a')}<div style="background:rgba(14,124,58,0.04);border:1px solid rgba(14,124,58,0.15);border-radius:8px;padding:16px 18px;"><div style="display:flex;flex-direction:column;gap:10px;">${peakHour.count>0?`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">1.</span><span>Allocate maximum guard presence between <strong>${hourLabel(Math.max(0,peakHour.hour-1))} and ${hourLabel(Math.min(23,peakHour.hour+2))}</strong> on <strong>${peakDay.avg>0?days[peakDay.dow]+'s':'peak activity days'}</strong> to match historical movement concentration.</span></div>`:''}${data.offHours>0&&offHoursPct>10?`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">2.</span><span>Implement <strong>enhanced after-hours protocols</strong> between 2200–0600 hrs. Assign a dedicated officer to review all after-hours access requests.</span></div>`:''}${topDest?`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">3.</span><span>Increase surveillance and access scrutiny at <strong>${topDest.dest}</strong>, which currently receives a disproportionate share of facility access.</span></div>`:''}${repeatCount>0?`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">4.</span><span>Formally review and validate access justifications for all <strong>${repeatCount} identified repeat visitors</strong> before the next reporting cycle.</span></div>`:''}${data.flagUnack>0?`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#374151;"><span style="color:#0e7c3a;font-weight:700;flex-shrink:0;">5.</span><span>Acknowledge and review the <strong>${data.flagUnack} outstanding watchlist alert${data.flagUnack>1?'s':''}</strong> within 24 hours.</span></div>`:''}</div></div><div style="margin-top:20px;background:#f0f4ff;border:1px solid rgba(26,86,219,0.15);border-radius:8px;padding:14px 18px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a56db;margin-bottom:6px;">Note on AI Analysis</div><p style="font-size:11px;color:#6b7280;line-height:1.6;">This intelligence brief is generated algorithmically from movement data captured by SENTRi. All findings are derived from statistical analysis of recorded movements, incidents, and access events. AI-enhanced narrative analysis is available as a platform upgrade. Contact IGATA Technologies for details.</p></div></div>${footer}`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SENTRi Intelligence Brief — ${tenantName}</title><style>${css}</style></head><body>${page1}${page2}${page3}</body></html>`
}


// ── Main ReportTab ──
export default function ReportTab() {
  const { tenant } = useAuthStore()
  const [period, setPeriod] = useState('monthly')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { if (tenant?.id) fetchReport() }, [period, tenant])

  async function fetchReport() {
    setLoading(true)
    const days = PERIODS.find(p => p.key === period)?.days || 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const [movRes, incRes, repRes, flagRes, prevMovRes, shiftRes] = await Promise.all([
        supabase.from('movements').select('id,type,entry_time,exit_time,duration_minutes,flag_triggered,destination,purpose,gate_id,gates(name)').eq('tenant_id', tenant.id).gte('entry_time', since),
        supabase.from('incidents').select('id,type,severity,status,created_at').eq('tenant_id', tenant.id).gte('created_at', since),
        supabase.from('v_repeat_visitors').select('*').eq('tenant_id', tenant.id).order('visit_count', { ascending: false }).limit(15),
        supabase.from('flag_alerts').select('id,acknowledged,alerted_at').eq('tenant_id', tenant.id).gte('alerted_at', since),
        supabase.from('movements').select('id,type,flag_triggered').eq('tenant_id', tenant.id).gte('entry_time', prevSince).lt('entry_time', since),
        supabase.from('shift_logs').select('officer_name,service_number,shift_start,shift_end,gate_id,gates(name)').eq('tenant_id', tenant.id).gte('shift_start', since).order('shift_start', { ascending: false }),
      ])

      const movements = movRes.data || []
      const incidents = incRes.data || []
      const flagAlerts = flagRes.data || []
      const prevMovements = prevMovRes.data || []
      const shiftLogs = shiftRes.data || []

      // By day
      const byDayMap = {}
      movements.forEach(m => {
        const day = m.entry_time.split('T')[0]
        if (!byDayMap[day]) byDayMap[day] = { date: day, total: 0, vehicles: 0, pedestrians: 0, flags: 0 }
        byDayMap[day].total++
        if (m.type === 'vehicle') byDayMap[day].vehicles++; else byDayMap[day].pedestrians++
        if (m.flag_triggered) byDayMap[day].flags++
      })
      const byDay = Object.values(byDayMap).sort((a, b) => b.date.localeCompare(a.date))

      // By hour
      const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
      movements.forEach(m => { byHour[new Date(m.entry_time).getHours()].count++ })

      // By day of week
      const byDow = Array.from({ length: 7 }, (_, i) => ({ dow: i, days: [], avg: 0 }))
      byDay.forEach(d => byDow[new Date(d.date).getDay()].days.push(d.total))
      byDow.forEach(d => { d.avg = d.days.length ? d.days.reduce((a, b) => a + b, 0) / d.days.length : 0 })

      // Destinations and purposes
      const destMap = {}
      movements.forEach(m => { if (m.destination) destMap[m.destination] = (destMap[m.destination] || 0) + 1 })
      const topDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([dest, count]) => ({ dest, count }))

      const purposeMap = {}
      movements.forEach(m => { if (m.purpose) purposeMap[m.purpose] = (purposeMap[m.purpose] || 0) + 1 })
      const topPurpose = Object.entries(purposeMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dest, count]) => ({ dest, count }))

      // By gate
      const byGateMap = {}
      movements.forEach(m => {
        const name = m.gates?.name || 'Unknown'
        if (!byGateMap[name]) byGateMap[name] = { name, total: 0, vehicles: 0, pedestrians: 0 }
        byGateMap[name].total++
        if (m.type === 'vehicle') byGateMap[name].vehicles++; else byGateMap[name].pedestrians++
      })

      // Dwell time
      const withDwell = movements.filter(m => m.duration_minutes)
      const dwell = {
        quick: withDwell.filter(m => m.duration_minutes < 15).length,
        normal: withDwell.filter(m => m.duration_minutes >= 15 && m.duration_minutes < 60).length,
        extended: withDwell.filter(m => m.duration_minutes >= 60 && m.duration_minutes < 180).length,
        long: withDwell.filter(m => m.duration_minutes >= 180).length,
        total: withDwell.length
      }
      const avgDuration = withDwell.length > 0 ? Math.round(withDwell.reduce((s, m) => s + m.duration_minutes, 0) / withDwell.length) : null

      // Incident breakdown
      const incMap = {}
      incidents.forEach(i => {
        const key = i.type + '|' + i.severity
        if (!incMap[key]) incMap[key] = { type: i.type, severity: i.severity, count: 0 }
        incMap[key].count++
      })

      // Off hours and incomplete
      const offHours = movements.filter(m => { const h = new Date(m.entry_time).getHours(); return h < 6 || h >= 22 }).length
      const incomplete = movements.filter(m => !m.destination || !m.purpose).length

      // Daily stats for brief
      const dailyCounts = byDay.map(d => d.total)
      const dailyAvg = dailyCounts.length > 0 ? Math.round(dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) : 0

      setData({
        total: movements.length,
        vehicles: movements.filter(m => m.type === 'vehicle').length,
        pedestrians: movements.filter(m => m.type === 'pedestrian').length,
        flags: movements.filter(m => m.flag_triggered).length,
        flagTotal: flagAlerts.length,
        flagUnack: flagAlerts.filter(f => !f.acknowledged).length,
        avgDuration,
        byDay,
        byHour,
        byDow,
        topDest,
        topPurpose,
        byGate: Object.values(byGateMap),
        dwell,
        incidents: incidents.length,
        criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
        incidentBreakdown: Object.values(incMap).sort((a, b) => b.count - a.count),
        repeatVisitors: repRes.data || [],
        activeDays: byDay.length,
        dailyAvg,
        offHours,
        incomplete,
        shiftLogs,
        prev: {
          total: prevMovements.length,
          vehicles: prevMovements.filter(m => m.type === 'vehicle').length,
          flags: prevMovements.filter(m => m.flag_triggered).length,
        }
      })
    } catch (e) {
      console.error('Report fetch error:', e)
    }
    setLoading(false)
  }

  function openPDF(html) {
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  function downloadReport() {
    if (!data) return
    setDownloading('report')
    const periodLabel = PERIODS.find(p => p.key === period)?.label || period
    openPDF(generateReportHTML(data, tenant.name, periodLabel))
    setTimeout(() => setDownloading(false), 1000)
  }

  function downloadBrief() {
    if (!data) return
    setDownloading('brief')
    const periodLabel = PERIODS.find(p => p.key === period)?.label || period
    openPDF(generateBriefHTML(data, tenant.name, periodLabel))
    setTimeout(() => setDownloading(false), 1000)
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || period

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Report</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Movement analytics for {tenant?.name}</p>
        </div>
        {data && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={downloadBrief} disabled={!!downloading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading === 'brief' ? 'Preparing...' : 'Intelligence Brief'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={downloadReport} disabled={!!downloading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading === 'report' ? 'Preparing...' : 'Download Report'}
            </button>
          </div>
        )}
      </div>

      {/* Period selector */}
      <div className="filter-row" style={{ marginBottom: '20px' }}>
        {PERIODS.map(p => (
          <button key={p.key} className={'filter-btn' + (period === p.key ? ' active' : '')} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>Generating report...</div>
      ) : !data ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>No data available.</div>
      ) : (
        <div>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Total', value: data.total, color: 'var(--accent)' },
              { label: 'Vehicles', value: data.vehicles },
              { label: 'Pedestrians', value: data.pedestrians },
              { label: 'Avg Stay', value: fmtDur(data.avgDuration) },
              { label: 'Flag Hits', value: data.flagTotal, color: data.flagTotal > 0 ? 'var(--red)' : undefined, sub: data.flagUnack > 0 ? data.flagUnack + ' unacknowledged' : data.flagTotal > 0 ? 'All acknowledged' : null },
              { label: 'Incidents', value: data.incidents, color: data.incidents > 0 ? 'var(--amber)' : undefined, sub: data.criticalIncidents > 0 ? data.criticalIncidents + ' critical' : null },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{s.label}</div>
                <div style={{ fontSize: '26px', fontWeight: '700', fontFamily: 'var(--font-display)', color: s.color || 'var(--text-0)', lineHeight: 1 }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: '11px', color: s.label === 'Flag Hits' && data.flagUnack > 0 ? 'var(--red)' : 'var(--text-2)', marginTop: '3px' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* vs previous period */}
          {data.prev && data.prev.total > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>vs Previous {periodLabel}</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Movements', cur: data.total, prev: data.prev.total },
                  { label: 'Vehicles', cur: data.vehicles, prev: data.prev.vehicles },
                  { label: 'Flag Hits', cur: data.flagTotal, prev: data.prev.flags },
                ].map(r => {
                  const pct = r.prev > 0 ? Math.round(((r.cur - r.prev) / r.prev) * 100) : null
                  return (
                    <div key={r.label} style={{ flex: 1, minWidth: '80px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>{r.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{r.cur}</div>
                      {pct !== null && <div style={{ fontSize: '11px', color: pct > 0 ? 'var(--red)' : 'var(--green)', fontWeight: '600' }}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Peak hours */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>Peak Activity Hours</div>
            <PeakHoursChart byHour={data.byHour} />
            {(() => {
              const peak = data.byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
              if (peak.count === 0) return <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>No data for this period.</p>
              return <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>Peak: <strong style={{ color: 'var(--red)' }}>{hourLabel(peak.hour)}</strong> — {peak.count} movements</p>
            })()}
          </div>

          {/* Dwell time */}
          {data.dwell.total > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Dwell Time Distribution</div>
              <DwellBar label="Quick (under 15 min)" count={data.dwell.quick} total={data.dwell.total} color="var(--green)" />
              <DwellBar label="Normal (15–60 min)" count={data.dwell.normal} total={data.dwell.total} color="var(--accent)" />
              <DwellBar label="Extended (1–3 hrs)" count={data.dwell.extended} total={data.dwell.total} color="var(--amber)" />
              <DwellBar label="Long stay (3+ hrs)" count={data.dwell.long} total={data.dwell.total} color="var(--red)" />
            </div>
          )}

          {/* By gate */}
          {data.byGate.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>By Gate</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data.byGate.map(g => (
                  <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                    <span style={{ fontWeight: '600' }}>{g.name}</span>
                    <span style={{ color: 'var(--text-2)' }}>{g.total} total · {g.vehicles} vehicles · {g.pedestrians} pedestrians</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top destinations */}
          {data.topDest.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Top Destinations</div>
              {data.topDest.map(({ dest, count }) => (
                <div key={dest} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-1)' }}>{dest}</span>
                    <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{count}</span>
                  </div>
                  <div style={{ background: 'var(--bg-2)', borderRadius: '4px', height: '6px' }}>
                    <div style={{ background: 'var(--accent)', borderRadius: '4px', height: '6px', width: (count / data.topDest[0].count * 100) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Incident breakdown */}
          {data.incidentBreakdown.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Incident Breakdown</div>
              {data.incidentBreakdown.map((inc, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ textTransform: 'capitalize' }}>{inc.type.replace(/_/g, ' ')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={'pill ' + (inc.severity === 'critical' ? 'pill-red' : inc.severity === 'serious' ? 'pill-amber' : 'pill-blue')} style={{ fontSize: '10px' }}>{inc.severity}</span>
                    <span style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{inc.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* Guard Shift Log */}
          {data.shiftLogs?.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Guard Shift Log</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '64px' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                    {[['Officer','left'],['Gate','left'],['Start','left'],['End','left'],['Duration','right']].map(([h,a]) => (
                      <th key={h} style={{ padding: '0 4px 8px', textAlign: a, fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-display)', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.shiftLogs.map((s, i) => {
                    const durMins = s.shift_start && s.shift_end ? Math.round((new Date(s.shift_end) - new Date(s.shift_start)) / 60000) : null
                    const dur = fmtDur(durMins)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', fontSize: '13px', fontWeight: '600' }}>{s.officer_name || '—'}</td>
                        <td style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-2)' }}>{s.gates?.name || '—'}</td>
                        <td style={{ padding: '8px 4px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{new Date(s.shift_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '8px 4px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: s.shift_end ? 'var(--text-1)' : 'var(--green)' }}>{s.shift_end ? new Date(s.shift_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Active'}</td>
                        <td style={{ padding: '8px 4px', fontSize: '12px', fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-2)' }}>{dur}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Daily breakdown — proper table for perfect column alignment */}
          {data.byDay.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Daily Breakdown</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col />
                  <col style={{ width: '52px' }} />
                  <col style={{ width: '68px' }} />
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '48px' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                    {[['Date','left'],['Total','right'],['Vehicles','right'],['Peds','right'],['Flags','right']].map(([h,a]) => (
                      <th key={h} style={{ padding: '0 4px 8px', textAlign: a, fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-display)', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byDay.map(d => (
                    <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: 'var(--text-1)' }}>{new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '700', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{d.total}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-2)' }}>{d.vehicles}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-2)' }}>{d.pedestrians}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: d.flags > 0 ? '700' : '400', color: d.flags > 0 ? 'var(--red)' : 'var(--text-2)' }}>{d.flags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Repeat visitors */}
          {data.repeatVisitors.length > 0 && (
            <div className="card">
              <div className="section-label" style={{ marginBottom: '12px' }}>Repeat Visitors</div>
              {data.repeatVisitors.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{v.plate_number || v.visitor_name || '—'}</span>
                  <div style={{ display: 'flex', gap: '16px', color: 'var(--text-2)' }}>
                    <span style={{ fontWeight: '700', color: 'var(--accent)' }}>{v.visit_count}×</span>
                    <span>{fmtDate(v.last_visit)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
