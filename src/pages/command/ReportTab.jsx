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

// ── Intelligence Brief HTML (narrative format) ──
function generateBriefHTML(data, tenantName, periodLabel) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const peakHour = data.byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
  const peakDay = data.byDow.reduce((a, b) => b.avg > a.avg ? b : a, data.byDow[0] || { dow: 0, avg: 0 })
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const topDest = data.topDest[0]
  const topPurpose = data.topPurpose[0]

  const anomalies = []
  if (data.flagTotal > 0) anomalies.push(`<strong>${data.flagTotal} watchlist alert(s)</strong> were triggered${data.flagUnack > 0 ? ', with <strong style="color:#c0132a;">' + data.flagUnack + ' still unacknowledged</strong>' : ' — all acknowledged'}.`)
  if (data.incidents > 0) anomalies.push(`<strong>${data.incidents} incident(s)</strong> were reported${data.criticalIncidents > 0 ? ', including <strong style="color:#c0132a;">' + data.criticalIncidents + ' critical</strong>' : ''}.`)
  if (data.offHours > 0) anomalies.push(`<strong>${data.offHours} movement(s)</strong> were recorded outside normal hours (before 6am or after 10pm).`)
  if (data.incomplete > 0) anomalies.push(`<strong>${data.incomplete} entr${data.incomplete === 1 ? 'y' : 'ies'}</strong> logged with incomplete records.`)
  if (anomalies.length === 0) anomalies.push('No significant anomalies detected. Movement patterns are within normal parameters.')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>SENTRi Intelligence Brief — ${tenantName}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;background:white;}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}</style>
  </head><body>
  <div style="background:linear-gradient(135deg,#0a0f1e 0%,#0f1923 60%,#1a2235 100%);padding:36px 40px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div><div style="color:white;font-size:28px;font-weight:800;letter-spacing:0.1em;">SENTRi</div><div style="color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px;">Movement Intelligence Platform</div></div>
      <div style="text-align:right;"><div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">Generated</div><div style="color:white;font-size:13px;font-weight:600;margin-top:2px;">${now}</div><div style="display:inline-block;margin-top:6px;background:rgba(192,19,42,0.3);border:1px solid rgba(192,19,42,0.5);color:#ff8a9a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:0.08em;">CONFIDENTIAL</div></div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;">
      <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Intelligence Brief</div>
      <div style="color:white;font-size:22px;font-weight:700;">${tenantName}</div>
      <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px;">${periodLabel} · Automated analysis</div>
    </div>
  </div>
  <div style="padding:32px 40px;">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:32px;">
      ${[['Total Movements',data.total,'#1a56db'],['Active Days',data.activeDays,'#1a1a2e'],['Daily Average',data.dailyAvg,'#1a1a2e'],['Anomalies',anomalies.length === 1 && anomalies[0].includes('No significant') ? 0 : anomalies.length, anomalies.length > 1 || !anomalies[0].includes('No significant') ? '#c0132a' : '#0e7c3a']].map(([l,v,c]) => `<div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:14px;text-align:center;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;">${l}</div><div style="font-size:24px;font-weight:700;color:${c};">${v}</div></div>`).join('')}
    </div>

    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e6ed;">Anomalies & Alerts</h2>
    <div style="margin-bottom:28px;">
      ${anomalies.map(a => `<div style="margin-bottom:10px;padding:12px 14px;border-left:3px solid ${a.includes('critical') || a.includes('unacknowledged') ? '#c0132a' : a.includes('No significant') ? '#0e7c3a' : '#92530a'};background:#f8f9fb;border-radius:0 6px 6px 0;font-size:13px;color:#374151;line-height:1.6;">${a}</div>`).join('')}
    </div>

    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e6ed;">Pattern Analysis</h2>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:10px;">
      Over this period, <strong>${tenantName}</strong> recorded <strong>${data.total} total movements</strong> across ${data.activeDays} active days, averaging <strong>${data.dailyAvg} movements per day</strong>.
      ${peakHour.count > 0 ? 'Peak activity occurs at <strong>' + hourLabel(peakHour.hour) + '</strong> with ' + peakHour.count + ' movements.' : ''}
      ${peakDay.avg > 0 ? ' The busiest day of the week is <strong>' + days[peakDay.dow] + '</strong>.' : ''}
    </p>
    ${topDest ? `<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:10px;">The most visited destination is <strong>"${topDest.dest}"</strong> with ${topDest.count} visits (${Math.round(topDest.count / data.total * 100)}% of all movements).${Math.round(topDest.count / data.total * 100) > 50 ? ' This high concentration warrants attention.' : ''}</p>` : ''}
    ${topPurpose ? `<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:28px;">The most common stated purpose is <strong>"${topPurpose.dest}"</strong>, accounting for ${Math.round(topPurpose.count / data.total * 100)}% of entries.</p>` : '<div style="margin-bottom:28px;"></div>'}

    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e6ed;">Operational Summary</h2>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:28px;">
      ${data.incomplete > 0 ? '<strong>' + data.incomplete + ' entries</strong> were logged with incomplete records. ' : 'All entries were logged with complete records. '}
      ${data.dwell.total > 0 ? 'Average vehicle dwell time is <strong>' + (data.avgDuration || 'N/A') + ' minutes</strong>. ' : ''}
      ${data.repeatVisitors.length > 0 ? '<strong>' + data.repeatVisitors.length + ' repeat visitors</strong> were identified, with the highest frequency visitor appearing ' + data.repeatVisitors[0].visit_count + ' times.' : ''}
    </p>
  </div>
  <div style="padding:16px 40px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;background:#f8f9fb;">
    <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies · SENTRi Movement Intelligence</span>
    <span style="font-size:11px;color:#9ca3af;">CONFIDENTIAL — Authorised personnel only</span>
  </div>
  </body></html>`
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
      const [movRes, incRes, repRes, flagRes, prevMovRes] = await Promise.all([
        supabase.from('movements').select('id,type,entry_time,exit_time,duration_minutes,flag_triggered,destination,purpose,gate_id,gates(name)').eq('tenant_id', tenant.id).gte('entry_time', since),
        supabase.from('incidents').select('id,type,severity,status,created_at').eq('tenant_id', tenant.id).gte('created_at', since),
        supabase.from('v_repeat_visitors').select('*').eq('tenant_id', tenant.id).order('visit_count', { ascending: false }).limit(15),
        supabase.from('flag_alerts').select('id,acknowledged,alerted_at').eq('tenant_id', tenant.id).gte('alerted_at', since),
        supabase.from('movements').select('id,type,flag_triggered').eq('tenant_id', tenant.id).gte('entry_time', prevSince).lt('entry_time', since),
      ])

      const movements = movRes.data || []
      const incidents = incRes.data || []
      const flagAlerts = flagRes.data || []
      const prevMovements = prevMovRes.data || []

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: 'Total', value: data.total, color: 'var(--accent)' },
              { label: 'Vehicles', value: data.vehicles },
              { label: 'Pedestrians', value: data.pedestrians },
              { label: 'Avg Stay', value: data.avgDuration ? data.avgDuration + 'm' : '—' },
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

          {/* Daily breakdown */}
          {data.byDay.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Daily Breakdown</div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: '0 16px', padding: '0 0 6px', borderBottom: '1px solid var(--border)', marginBottom: '4px', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Date</span><span>Total</span><span>Vehicles</span><span>Peds</span><span>Flags</span>
              </div>
              {data.byDay.map(d => (
                <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: '0 16px', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-1)' }}>{new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{d.total}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{d.vehicles}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{d.pedestrians}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: d.flags > 0 ? 'var(--red)' : 'var(--text-2)', fontWeight: d.flags > 0 ? '700' : '400' }}>{d.flags}</span>
                </div>
              ))}
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
