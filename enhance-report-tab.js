const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Enhanced ReportTab with deep analytics')
console.log('='.repeat(52))

const filePath = path.join(process.cwd(), 'src', 'pages', 'command', 'ReportTab.jsx')

const content = `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const PERIODS = [
  { key: 'weekly', label: 'This Week', days: 7 },
  { key: 'monthly', label: 'This Month', days: 30 },
  { key: 'quarterly', label: 'This Quarter', days: 90 },
  { key: 'annually', label: 'This Year', days: 365 },
]

// ── Peak hours SVG bar chart ──
function PeakHoursChart({ byHour }) {
  const max = Math.max(...byHour.map(h => h.count), 1)
  const hours = byHour
  const BAR_W = 14
  const GAP = 3
  const H = 80
  const W = 24 * (BAR_W + GAP)

  return (
    <svg viewBox={\`0 0 \${W} \${H + 24}\`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {hours.map((h, i) => {
        const barH = max > 0 ? Math.max(3, Math.round((h.count / max) * H)) : 3
        const x = i * (BAR_W + GAP)
        const y = H - barH
        const isPeak = h.count === max && max > 0
        return (
          <g key={h.hour}>
            <rect x={x} y={y} width={BAR_W} height={barH}
              fill={isPeak ? '#c0132a' : h.count > 0 ? '#1a56db' : '#e2e6ed'}
              rx="2" />
            {(i % 6 === 0 || i === 12 || i === 18) && (
              <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle"
                fontSize="9" fill="#9ca3af">
                {h.hour === 0 ? '12a' : h.hour === 12 ? '12p' : h.hour < 12 ? h.hour + 'a' : (h.hour - 12) + 'p'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Dwell time bar (inline) ──
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

// ── Trend pill ──
function Trend({ current, previous, label }) {
  if (!previous || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct > 0
  const neutral = pct === 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
      <span style={{
        background: neutral ? 'var(--bg-2)' : up ? 'rgba(192,19,42,0.1)' : 'rgba(14,124,58,0.1)',
        color: neutral ? 'var(--text-2)' : up ? 'var(--red)' : 'var(--green)',
        padding: '2px 7px', borderRadius: '20px', fontWeight: '700', fontSize: '11px'
      }}>
        {neutral ? '─' : up ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
      <span>vs previous {label}</span>
    </div>
  )
}

// ── PDF HTML generator ──
function generateReportHTML(data, tenantName, periodLabel) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const peakHour = data.byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
  const peakLabel = peakHour.count > 0
    ? (peakHour.hour === 0 ? '12:00am' : peakHour.hour < 12 ? peakHour.hour + ':00am' : peakHour.hour === 12 ? '12:00pm' : (peakHour.hour - 12) + ':00pm')
    : 'N/A'

  const statCards = [
    { label: 'Total Movements', value: data.total, color: '#1a56db' },
    { label: 'Vehicles', value: data.vehicles, color: '#1a1a2e' },
    { label: 'Pedestrians', value: data.pedestrians, color: '#1a1a2e' },
    { label: 'Flag Hits', value: data.flags, color: data.flags > 0 ? '#c0132a' : '#1a1a2e' },
    { label: 'Incidents', value: data.incidents, color: data.incidents > 0 ? '#92530a' : '#1a1a2e' },
    { label: 'Critical Incidents', value: data.criticalIncidents, color: data.criticalIncidents > 0 ? '#c0132a' : '#1a1a2e' },
    { label: 'Avg Stay (min)', value: data.avgDuration || 'N/A', color: '#1a1a2e' },
    { label: 'Peak Hour', value: peakLabel, color: '#92530a' },
  ].map(s => \`
    <div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">\${s.label}</div>
      <div style="font-size:24px;font-weight:700;color:\${s.color};">\${s.value}</div>
    </div>
  \`).join('')

  // Peak hours bar chart in SVG for PDF
  const maxHour = Math.max(...data.byHour.map(h => h.count), 1)
  const hourBars = data.byHour.map((h, i) => {
    const barH = maxHour > 0 ? Math.max(2, Math.round((h.count / maxHour) * 60)) : 2
    const x = i * 17
    const y = 60 - barH
    const isPeak = h.count === maxHour && maxHour > 0
    return \`<rect x="\${x}" y="\${y}" width="14" height="\${barH}" fill="\${isPeak ? '#c0132a' : h.count > 0 ? '#1a56db' : '#e2e6ed'}" rx="2"/>\`
  }).join('')

  const gateRows = data.byGate.map(g => \`
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e6ed;">\${g.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${g.total}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e6ed;text-align:center;">\${g.vehicles}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e6ed;text-align:center;">\${g.pedestrians}</td>
    </tr>
  \`).join('')

  const dayRows = data.byDay.slice(0, 31).map(d => \`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${d.total}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;">\${d.vehicles}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;">\${d.pedestrians}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;color:\${d.flags > 0 ? '#c0132a' : '#6b7280'};font-weight:\${d.flags > 0 ? '700' : '400'};">\${d.flags}</td>
    </tr>
  \`).join('')

  const destRows = data.topDest.map(({ dest, count }) => \`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${dest}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${count}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">
        <div style="background:#e2e6ed;border-radius:4px;height:8px;">
          <div style="background:#1a56db;border-radius:4px;height:8px;width:\${Math.round(count / data.topDest[0].count * 100)}%;"></div>
        </div>
      </td>
    </tr>
  \`).join('')

  const repeatRows = data.repeatVisitors.map(v => \`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;font-family:monospace;">\${v.plate_number || v.visitor_name || '—'}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${v.visit_count}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${new Date(v.last_visit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
    </tr>
  \`).join('')

  const incidentRows = data.incidentBreakdown.map(inc => \`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${inc.type.replace(/_/g, ' ')}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${inc.count}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;color:\${inc.severity === 'critical' ? '#c0132a' : inc.severity === 'serious' ? '#92530a' : '#1a56db'};">\${inc.severity}</td>
    </tr>
  \`).join('')

  const dwellRows = [
    { label: 'Quick (<15 min)', count: data.dwell.quick, color: '#0e7c3a' },
    { label: 'Normal (15–60 min)', count: data.dwell.normal, color: '#1a56db' },
    { label: 'Extended (1–3 hrs)', count: data.dwell.extended, color: '#92530a' },
    { label: 'Long stay (3+ hrs)', count: data.dwell.long, color: '#c0132a' },
  ].filter(d => d.count > 0).map(d => \`
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${d.label}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${d.count}</td>
    </tr>
  \`).join('')

  const trendSection = data.prev ? \`
    <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;margin-bottom:12px;">Period Comparison</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Metric</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">This Period</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Previous</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Change</th>
      </tr></thead>
      <tbody>
        \${[
          { label: 'Total Movements', cur: data.total, prev: data.prev.total },
          { label: 'Vehicles', cur: data.vehicles, prev: data.prev.vehicles },
          { label: 'Flag Hits', cur: data.flags, prev: data.prev.flags },
          { label: 'Incidents', cur: data.incidents, prev: data.prev.incidents },
        ].map(r => {
          const pct = r.prev > 0 ? Math.round(((r.cur - r.prev) / r.prev) * 100) : 0
          const color = pct > 0 ? '#c0132a' : pct < 0 ? '#0e7c3a' : '#6b7280'
          return \`<tr>
            <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;">\${r.label}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:600;">\${r.cur}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;">\${r.prev}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e2e6ed;text-align:center;color:\${color};font-weight:600;">\${pct > 0 ? '+' : ''}\${pct}%</td>
          </tr>\`
        }).join('')}
      </tbody>
    </table>
  \` : ''

  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SENTRi Intelligence Report — \${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: white; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:36px 48px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="color:white;font-size:30px;font-weight:800;letter-spacing:0.1em;margin-bottom:2px;">SENTRi</div>
        <div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Movement Intelligence Platform</div>
      </div>
      <div style="text-align:right;">
        <div style="color:rgba(255,255,255,0.6);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">Generated</div>
        <div style="color:white;font-size:13px;font-weight:600;">\${now}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:10px;margin-top:2px;">CONFIDENTIAL</div>
      </div>
    </div>
    <div style="margin-top:28px;padding-top:22px;border-top:1px solid rgba(255,255,255,0.15);">
      <div style="color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Intelligence Report</div>
      <div style="color:white;font-size:24px;font-weight:700;">\${tenantName}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:4px;">\${periodLabel} Summary</div>
    </div>
  </div>

  <div style="padding:36px 48px;">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:14px;">Summary Statistics</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:36px;">\${statCards}</div>

    \${trendSection}

    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Peak Activity Hours</h2>
    <div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px;margin-bottom:8px;">
      <svg viewBox="0 0 408 84" style="width:100%;height:auto;">
        \${hourBars}
        <text x="0" y="78" font-size="8" fill="#9ca3af">12a</text>
        <text x="102" y="78" font-size="8" fill="#9ca3af">6a</text>
        <text x="204" y="78" font-size="8" fill="#9ca3af">12p</text>
        <text x="306" y="78" font-size="8" fill="#9ca3af">6p</text>
      </svg>
    </div>
    <p style="font-size:11px;color:#6b7280;margin-bottom:36px;">Peak hour: <strong>\${peakLabel}</strong> with \${peakHour.count} movements. Red bar indicates peak.</p>

    \${data.byGate.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Activity by Gate</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Gate</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Total</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Vehicles</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Pedestrians</th>
      </tr></thead>
      <tbody>\${gateRows}</tbody>
    </table>\` : ''}

    \${data.dwell.total > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Dwell Time Distribution</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Duration Range</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Count</th>
      </tr></thead>
      <tbody>\${dwellRows}</tbody>
    </table>\` : ''}

    \${data.topDest.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Top Destinations</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Destination</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Visits</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Frequency</th>
      </tr></thead>
      <tbody>\${destRows}</tbody>
    </table>\` : ''}

    \${data.byDay.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Daily Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Date</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Total</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Vehicles</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Pedestrians</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Flags</th>
      </tr></thead>
      <tbody>\${dayRows}</tbody>
    </table>\` : ''}

    \${data.repeatVisitors.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Repeat Visitors</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Plate / Name</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Visits</th>
        <th style="padding:8px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Last Visit</th>
      </tr></thead>
      <tbody>\${repeatRows}</tbody>
    </table>\` : ''}

    \${data.incidentBreakdown.length > 0 ? \`
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:12px;">Incident Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Type</th>
        <th style="padding:8px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Count</th>
        <th style="padding:8px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Severity</th>
      </tr></thead>
      <tbody>\${incidentRows}</tbody>
    </table>\` : ''}

  </div>
  <div style="padding:18px 48px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span>
    <span style="font-size:11px;color:#9ca3af;">SENTRi Movement Intelligence — CONFIDENTIAL</span>
  </div>
</body>
</html>\`
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

    const [movRes, incRes, repRes, prevMovRes, prevIncRes] = await Promise.all([
      supabase.from('movements').select('id,type,entry_time,exit_time,duration_minutes,flag_triggered,destination,gate_id,gates(name)').eq('tenant_id', tenant.id).gte('entry_time', since),
      supabase.from('incidents').select('id,type,severity,status,created_at').eq('tenant_id', tenant.id).gte('created_at', since),
      supabase.from('v_repeat_visitors').select('*').eq('tenant_id', tenant.id).order('visit_count', { ascending: false }).limit(15),
      supabase.from('movements').select('id,type,flag_triggered').eq('tenant_id', tenant.id).gte('entry_time', prevSince).lt('entry_time', since),
      supabase.from('incidents').select('id,severity').eq('tenant_id', tenant.id).gte('created_at', prevSince).lt('created_at', since),
    ])

    const movements = movRes.data || []
    const incidents = incRes.data || []
    const prevMovements = prevMovRes.data || []
    const prevIncidents = prevIncRes.data || []

    // By day
    const byDayMap = {}
    movements.forEach(m => {
      const day = m.entry_time.split('T')[0]
      if (!byDayMap[day]) byDayMap[day] = { date: day, total: 0, vehicles: 0, pedestrians: 0, flags: 0 }
      byDayMap[day].total++
      if (m.type === 'vehicle') byDayMap[day].vehicles++; else byDayMap[day].pedestrians++
      if (m.flag_triggered) byDayMap[day].flags++
    })

    // By hour
    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
    movements.forEach(m => {
      const h = new Date(m.entry_time).getHours()
      byHour[h].count++
    })

    // Destinations
    const destCount = {}
    movements.forEach(m => { if (m.destination) destCount[m.destination] = (destCount[m.destination] || 0) + 1 })
    const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([dest, count]) => ({ dest, count }))

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

    // Avg duration
    const avgDuration = withDwell.length > 0
      ? Math.round(withDwell.reduce((s, m) => s + m.duration_minutes, 0) / withDwell.length)
      : null

    // Incident breakdown
    const incMap = {}
    incidents.forEach(i => {
      const key = i.type + '|' + i.severity
      if (!incMap[key]) incMap[key] = { type: i.type, severity: i.severity, count: 0 }
      incMap[key].count++
    })

    setData({
      total: movements.length,
      vehicles: movements.filter(m => m.type === 'vehicle').length,
      pedestrians: movements.filter(m => m.type === 'pedestrian').length,
      flags: movements.filter(m => m.flag_triggered).length,
      avgDuration,
      byDay: Object.values(byDayMap).sort((a, b) => b.date.localeCompare(a.date)),
      byHour,
      topDest,
      byGate: Object.values(byGateMap),
      dwell,
      incidents: incidents.length,
      criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
      incidentBreakdown: Object.values(incMap).sort((a, b) => b.count - a.count),
      repeatVisitors: repRes.data || [],
      prev: {
        total: prevMovements.length,
        vehicles: prevMovements.filter(m => m.type === 'vehicle').length,
        flags: prevMovements.filter(m => m.flag_triggered).length,
        incidents: prevIncidents.length,
      }
    })
    setLoading(false)
  }

  function downloadPDF() {
    if (!data) return
    setDownloading(true)
    const periodLabel = PERIODS.find(p => p.key === period)?.label || period
    const html = generateReportHTML(data, tenant.name, periodLabel)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); setDownloading(false) }, 600)
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || period

  return (
    <div className="report-tab">
      <div className="tab-header">
        <div>
          <h2>Intelligence Report</h2>
          <p className="tab-sub">Movement analytics for {tenant?.name}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div className="filter-row" style={{ margin: 0 }}>
          {PERIODS.map(p => (
            <button key={p.key} className={'filter-btn' + (period === p.key ? ' active' : '')} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {data && (
          <button className="btn btn-primary btn-sm" onClick={downloadPDF} disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? 'Preparing...' : 'Download PDF'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Generating report...</div>
      ) : !data ? null : (
        <div className="report-content">

          {/* Summary stats */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Total', value: data.total },
              { label: 'Vehicles', value: data.vehicles },
              { label: 'Pedestrians', value: data.pedestrians },
              { label: 'Flags', value: data.flags, red: data.flags > 0 },
              { label: 'Incidents', value: data.incidents, amber: data.incidents > 0 },
              { label: 'Critical', value: data.criticalIncidents, red: data.criticalIncidents > 0 },
              ...(data.avgDuration ? [{ label: 'Avg Stay', value: data.avgDuration + 'm' }] : []),
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.red ? 'var(--red)' : s.amber ? 'var(--amber)' : undefined }}>{s.value}</div>
                {s.label === 'Total' && data.prev && (
                  <Trend current={data.total} previous={data.prev.total} label={periodLabel.toLowerCase()} />
                )}
              </div>
            ))}
          </div>

          {/* Peak hours */}
          <div className="report-section">
            <h3>Peak Activity Hours</h3>
            <div className="card" style={{ padding: '16px 12px 8px' }}>
              <PeakHoursChart byHour={data.byHour} />
              {(() => {
                const peak = data.byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
                if (peak.count === 0) return <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>No movement data for this period.</p>
                const label = peak.hour === 0 ? '12:00am' : peak.hour < 12 ? peak.hour + ':00am' : peak.hour === 12 ? '12:00pm' : (peak.hour - 12) + ':00pm'
                return <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>Peak: <strong style={{ color: 'var(--red)' }}>{label}</strong> — {peak.count} movements</p>
              })()}
            </div>
          </div>

          {/* Period comparison */}
          {data.prev && (
            <div className="report-section">
              <h3>vs Previous {periodLabel}</h3>
              <div className="report-table">
                <div className="table-header"><span>Metric</span><span>This period</span><span>Previous</span><span>Change</span></div>
                {[
                  { label: 'Total Movements', cur: data.total, prev: data.prev.total },
                  { label: 'Vehicles', cur: data.vehicles, prev: data.prev.vehicles },
                  { label: 'Flag Hits', cur: data.flags, prev: data.prev.flags },
                  { label: 'Incidents', cur: data.incidents, prev: data.prev.incidents },
                ].map(r => {
                  const pct = r.prev > 0 ? Math.round(((r.cur - r.prev) / r.prev) * 100) : null
                  return (
                    <div className="table-row" key={r.label}>
                      <span>{r.label}</span>
                      <span style={{ fontWeight: '600' }}>{r.cur}</span>
                      <span style={{ color: 'var(--text-2)' }}>{r.prev}</span>
                      <span style={{ color: pct === null ? 'var(--text-2)' : pct > 0 ? 'var(--red)' : pct < 0 ? 'var(--green)' : 'var(--text-2)', fontWeight: '600' }}>
                        {pct === null ? '—' : (pct > 0 ? '+' : '') + pct + '%'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* By gate */}
          {data.byGate.length > 0 && (
            <div className="report-section">
              <h3>By Gate</h3>
              <div className="report-table">
                <div className="table-header"><span>Gate</span><span>Total</span><span>Vehicles</span><span>Pedestrians</span></div>
                {data.byGate.map(g => (
                  <div className="table-row" key={g.name}><span>{g.name}</span><span>{g.total}</span><span>{g.vehicles}</span><span>{g.pedestrians}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* Dwell time */}
          {data.dwell.total > 0 && (
            <div className="report-section">
              <h3>Dwell Time Distribution</h3>
              <div className="card" style={{ padding: '16px' }}>
                <DwellBar label="Quick (under 15 min)" count={data.dwell.quick} total={data.dwell.total} color="var(--green)" />
                <DwellBar label="Normal (15–60 min)" count={data.dwell.normal} total={data.dwell.total} color="var(--accent)" />
                <DwellBar label="Extended (1–3 hrs)" count={data.dwell.extended} total={data.dwell.total} color="var(--amber)" />
                <DwellBar label="Long stay (3+ hrs)" count={data.dwell.long} total={data.dwell.total} color="var(--red)" />
              </div>
            </div>
          )}

          {/* Top destinations */}
          {data.topDest.length > 0 && (
            <div className="report-section">
              <h3>Top Destinations</h3>
              <div className="dest-list">
                {data.topDest.map(({ dest, count }) => (
                  <div className="dest-row" key={dest}>
                    <span className="dest-name">{dest}</span>
                    <div className="dest-bar-wrap"><div className="dest-bar" style={{ width: (count / data.topDest[0].count * 100) + '%' }} /></div>
                    <span className="dest-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily breakdown */}
          {data.byDay.length > 0 && (
            <div className="report-section">
              <h3>Daily Breakdown</h3>
              <div className="report-table">
                <div className="table-header"><span>Date</span><span>Total</span><span>Vehicles</span><span>Pedestrians</span><span>Flags</span></div>
                {data.byDay.map(d => (
                  <div className="table-row" key={d.date}>
                    <span>{new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span>{d.total}</span><span>{d.vehicles}</span><span>{d.pedestrians}</span>
                    <span className={d.flags > 0 ? 'text-red' : ''}>{d.flags}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repeat visitors */}
          {data.repeatVisitors.length > 0 && (
            <div className="report-section">
              <h3>Repeat Visitors</h3>
              <div className="report-table">
                <div className="table-header"><span>Plate / Name</span><span>Visits</span><span>Last Visit</span></div>
                {data.repeatVisitors.map((v, i) => (
                  <div className="table-row" key={i}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{v.plate_number || v.visitor_name || '--'}</span>
                    <span style={{ fontWeight: '600' }}>{v.visit_count}</span>
                    <span>{new Date(v.last_visit).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incident breakdown */}
          {data.incidentBreakdown.length > 0 && (
            <div className="report-section">
              <h3>Incident Breakdown</h3>
              <div className="report-table">
                <div className="table-header"><span>Type</span><span>Count</span><span>Severity</span></div>
                {data.incidentBreakdown.map((inc, i) => (
                  <div className="table-row" key={i}>
                    <span style={{ textTransform: 'capitalize' }}>{inc.type.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: '600' }}>{inc.count}</span>
                    <span className={'pill ' + (inc.severity === 'critical' ? 'pill-red' : inc.severity === 'serious' ? 'pill-amber' : 'pill-blue')} style={{ fontSize: '10px' }}>{inc.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
`

fs.writeFileSync(filePath, content, 'utf8')
console.log('✓ ReportTab.jsx written')

// Verify no duplicate imports
const written = fs.readFileSync(filePath, 'utf8')
const importCount = (written.match(/^import \{ useState/mg) || []).length
console.log('✓ useState import count:', importCount)
if (importCount !== 1) { console.log('✗ Import count wrong'); process.exit(1) }

// Git
try {
  execSync('git add src/pages/command/ReportTab.jsx', { stdio: 'inherit' })
  execSync('git commit -m "Feature: enhanced report tab with peak hours, trend comparison, dwell time, incident breakdown"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nDone. Check Netlify in ~60 seconds.')
