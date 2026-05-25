import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

// ── Helpers ──
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }
function stdDev(arr) {
  const m = mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length || 1))
}
function fmt(dt) { return new Date(dt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtTime(dt) { return new Date(dt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) }
function hourLabel(h) { return h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm' }

// ── Signal pill ──
function Signal({ level, text }) {
  const colors = {
    critical: { bg: 'rgba(192,19,42,0.1)', color: '#c0132a', border: 'rgba(192,19,42,0.25)' },
    warning:  { bg: 'rgba(146,83,10,0.1)',  color: '#92530a', border: 'rgba(146,83,10,0.25)' },
    info:     { bg: 'rgba(26,86,219,0.1)',   color: '#1a56db', border: 'rgba(26,86,219,0.25)' },
    ok:       { bg: 'rgba(14,124,58,0.08)',  color: '#0e7c3a', border: 'rgba(14,124,58,0.2)' },
  }
  const c = colors[level] || colors.info
  return (
    <span style={{ background: c.bg, color: c.color, border: '1px solid ' + c.border,
      borderRadius: '20px', fontSize: '10px', fontWeight: '700', padding: '2px 8px',
      textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
      {text}
    </span>
  )
}

// ── Finding card ──
function Finding({ level, title, body, meta }) {
  const leftColors = { critical: 'var(--red)', warning: 'var(--amber)', info: 'var(--accent)', ok: 'var(--green)' }
  return (
    <div className="card" style={{ marginBottom: '10px', padding: '14px 16px',
      borderLeft: '3px solid ' + (leftColors[level] || 'var(--accent)') }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: body ? '6px' : 0 }}>
        <div style={{ fontWeight: '600', fontSize: '13px', lineHeight: 1.4 }}>{title}</div>
        <Signal level={level} text={level === 'ok' ? 'Normal' : level === 'info' ? 'Note' : level === 'warning' ? 'Watch' : 'Alert'} />
      </div>
      {body && <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{body}</p>}
      {meta && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>{meta}</div>}
    </div>
  )
}

// ── Heatmap row ──
function HourHeatmap({ byHour }) {
  const max = Math.max(...byHour.map(h => h.count), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px' }}>
      {byHour.map(h => {
        const intensity = h.count / max
        const bg = intensity === 0 ? 'var(--bg-2)'
          : intensity < 0.25 ? 'rgba(26,86,219,0.15)'
          : intensity < 0.5  ? 'rgba(26,86,219,0.35)'
          : intensity < 0.75 ? 'rgba(26,86,219,0.6)'
          : 'rgba(26,86,219,0.9)'
        return (
          <div key={h.hour} title={hourLabel(h.hour) + ': ' + h.count}
            style={{ height: '28px', borderRadius: '3px', background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {h.count > 0 && intensity > 0.4 && (
              <span style={{ fontSize: '8px', color: 'white', fontWeight: '700' }}>{h.count}</span>
            )}
          </div>
        )
      })}
      {[0,6,12,18,23].map(h => (
        <div key={h} style={{ gridColumn: h + 1, fontSize: '8px', color: 'var(--text-2)', textAlign: 'center', marginTop: '2px' }}>
          {hourLabel(h)}
        </div>
      ))}
    </div>
  )
}

// ── Day of week chart ──
function DayChart({ byDow }) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const max = Math.max(...byDow.map(d => d.avg), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
      {byDow.map((d, i) => {
        const h = Math.max(4, Math.round((d.avg / max) * 70))
        const isPeak = d.avg === max
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-2)', fontWeight: '600' }}>{Math.round(d.avg)}</div>
            <div style={{ width: '100%', height: h + 'px', borderRadius: '4px 4px 0 0',
              background: isPeak ? 'var(--red)' : 'var(--accent)', opacity: isPeak ? 1 : 0.6 }} />
            <div style={{ fontSize: '9px', color: 'var(--text-2)' }}>{days[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Intelligence Brief HTML generator ──
function generateBriefHTML(intel, tenantName) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const anomalySection = intel.anomalies.length === 0
    ? '<p style="color:#6b7280;font-size:13px;">No significant anomalies detected in the analysis period.</p>'
    : intel.anomalies.map(a => `
      <div style="margin-bottom:12px;padding:12px 16px;border-left:3px solid ${a.level === 'critical' ? '#c0132a' : a.level === 'warning' ? '#92530a' : '#1a56db'};background:#f8f9fb;border-radius:0 6px 6px 0;">
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${a.title}</div>
        <div style="font-size:12px;color:#6b7280;">${a.body}</div>
        ${a.meta ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;font-family:monospace;">${a.meta}</div>` : ''}
      </div>
    `).join('')

  const patternSection = `
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
      Over the analysis period, <strong>${tenantName}</strong> recorded <strong>${intel.summary.total} total movements</strong>
      across ${intel.summary.days} active days, averaging <strong>${intel.summary.dailyAvg} movements per day</strong>.
      ${intel.summary.peakDay ? 'The busiest day of the week is <strong>' + intel.summary.peakDay + '</strong>.' : ''}
      ${intel.summary.peakHour !== null ? 'Peak activity occurs at <strong>' + hourLabel(intel.summary.peakHour) + '</strong>.' : ''}
    </p>
    ${intel.summary.purposeInsight ? `<p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">${intel.summary.purposeInsight}</p>` : ''}
    ${intel.summary.destInsight ? `<p style="font-size:13px;color:#374151;line-height:1.7;">${intel.summary.destInsight}</p>` : ''}
  `

  const visitorSection = `
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
      <strong>${intel.visitors.newCount}</strong> first-time entries recorded.
      <strong>${intel.visitors.returningCount}</strong> returning vehicles or visitors.
      ${intel.visitors.topRepeater ? 'The most frequent visitor is <strong>' + (intel.visitors.topRepeater.plate_number || intel.visitors.topRepeater.visitor_name || 'Unknown') + '</strong> with ' + intel.visitors.topRepeater.visit_count + ' visits.' : ''}
    </p>
    ${intel.visitors.multiName.length > 0 ? `
      <p style="font-size:13px;color:#374151;line-height:1.7;">
        <strong>${intel.visitors.multiName.length} vehicle(s)</strong> were recorded with multiple different visitor names — these warrant review.
      </p>
    ` : ''}
    ${intel.visitors.noId.length > 0 ? `
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-top:8px;">
        <strong>${intel.visitors.noId.length} pedestrian entries</strong> were logged without an ID number on record.
      </p>
    ` : ''}
  `

  const operationalSection = `
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
      ${intel.ops.incomplete > 0 ? '<strong>' + intel.ops.incomplete + ' entries</strong> were logged with incomplete records (no destination or purpose). ' : 'All entries were logged with complete records. '}
      ${intel.ops.avgOcr !== null ? 'Average plate scan confidence was <strong>' + intel.ops.avgOcr + '%</strong>.' + (intel.ops.lowOcr > 0 ? ' <strong>' + intel.ops.lowOcr + ' scans</strong> fell below 70% confidence.' : '') : ''}
    </p>
    ${intel.ops.notesCount > 0 ? `<p style="font-size:13px;color:#374151;line-height:1.7;">Guards added notes to <strong>${intel.ops.notesCount} entries</strong>, indicating manually flagged situations beyond the standard log.</p>` : ''}
  `

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SENTRi Intelligence Brief — ${tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: white; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0a0f1e 0%,#0f1923 60%,#1a2235 100%);padding:40px 48px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
      <div>
        <div style="color:white;font-size:30px;font-weight:800;letter-spacing:0.1em;">SENTRi</div>
        <div style="color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px;">Movement Intelligence Platform</div>
      </div>
      <div style="text-align:right;">
        <div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">Generated</div>
        <div style="color:white;font-size:13px;font-weight:600;margin-top:2px;">${now} at ${nowTime}</div>
        <div style="display:inline-block;margin-top:8px;background:rgba(192,19,42,0.3);border:1px solid rgba(192,19,42,0.5);color:#ff8a9a;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:0.08em;">CONFIDENTIAL</div>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;">
      <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Intelligence Brief</div>
      <div style="color:white;font-size:26px;font-weight:700;">${tenantName}</div>
      <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px;">Last 90 days · Automated pattern and anomaly analysis</div>
    </div>
  </div>

  <div style="padding:40px 48px;">

    <!-- Summary bar -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:40px;">
      ${[
        { label: 'Total Movements', value: intel.summary.total, color: '#1a56db' },
        { label: 'Active Days', value: intel.summary.days, color: '#1a1a2e' },
        { label: 'Daily Average', value: intel.summary.dailyAvg, color: '#1a1a2e' },
        { label: 'Anomalies Detected', value: intel.anomalies.length, color: intel.anomalies.length > 0 ? '#c0132a' : '#0e7c3a' },
      ].map(s => `
        <div style="background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${s.label}</div>
          <div style="font-size:28px;font-weight:700;color:${s.color};">${s.value}</div>
        </div>
      `).join('')}
    </div>

    <!-- Anomalies -->
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Anomalies & Alerts
    </h2>
    <div style="margin-bottom:36px;">${anomalySection}</div>

    <!-- Pattern analysis -->
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Pattern Analysis
    </h2>
    <div style="margin-bottom:36px;">${patternSection}</div>

    <!-- Visitor intelligence -->
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Visitor Intelligence
    </h2>
    <div style="margin-bottom:36px;">${visitorSection}</div>

    <!-- Operational -->
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      Operational Intelligence
    </h2>
    <div style="margin-bottom:40px;">${operationalSection}</div>

    <!-- Top repeat visitors table -->
    ${intel.visitors.top.length > 0 ? `
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e2e6ed;">
      High-Frequency Visitors
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:40px;">
      <thead><tr style="background:#f8f9fb;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Plate / Name</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Visits</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">First Seen</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Last Seen</th>
        <th style="padding:10px 14px;font-size:11px;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e2e6ed;">Top Destination</th>
      </tr></thead>
      <tbody>
        ${intel.visitors.top.map(v => `
          <tr>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;font-family:monospace;font-weight:600;">${v.plate_number || v.visitor_name || '—'}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;text-align:center;font-weight:700;">${v.visit_count}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">${fmt(v.first_visit)}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">${fmt(v.last_visit)}</td>
            <td style="padding:9px 14px;border-bottom:1px solid #e2e6ed;">${v.top_destination || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : ''}

  </div>

  <div style="padding:20px 48px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;align-items:center;background:#f8f9fb;">
    <span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies · SENTRi Movement Intelligence</span>
    <span style="font-size:11px;color:#9ca3af;">This document is CONFIDENTIAL and for authorised personnel only</span>
  </div>
</body>
</html>`
}

// ── Main IntelligenceTab ──
export default function IntelligenceTab() {
  const { tenant } = useAuthStore()
  const [intel, setIntel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [section, setSection] = useState('anomalies')

  useEffect(() => { if (tenant?.id) analyse() }, [tenant])

  async function analyse() {
    setLoading(true)
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [movRes, repRes] = await Promise.all([
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
    ])

    const movements = movRes.data || []
    const repeatVisitors = repRes.data || []

    if (movements.length === 0) {
      setIntel({ empty: true })
      setLoading(false)
      return
    }

    // ── By day ──
    const byDayMap = {}
    movements.forEach(m => {
      const day = m.entry_time.split('T')[0]
      if (!byDayMap[day]) byDayMap[day] = { date: day, total: 0, vehicles: 0, flags: 0, dow: new Date(day).getDay() }
      byDayMap[day].total++
      if (m.type === 'vehicle') byDayMap[day].vehicles++
      if (m.flag_triggered) byDayMap[day].flags++
    })
    const byDay = Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date))
    const dailyCounts = byDay.map(d => d.total)
    const dailyMean = mean(dailyCounts)
    const dailySD = stdDev(dailyCounts)

    // ── By hour ──
    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
    movements.forEach(m => { byHour[new Date(m.entry_time).getHours()].count++ })
    const peakHour = byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })

    // ── By day of week ──
    const dowMap = Array.from({ length: 7 }, (_, i) => ({ dow: i, days: [], avg: 0 }))
    byDay.forEach(d => dowMap[d.dow].days.push(d.total))
    dowMap.forEach(d => { d.avg = d.days.length ? mean(d.days) : 0 })
    const peakDow = dowMap.reduce((a, b) => b.avg > a.avg ? b : a, dowMap[0])
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

    // ── Destinations ──
    const destMap = {}
    movements.forEach(m => { if (m.destination) destMap[m.destination] = (destMap[m.destination] || 0) + 1 })
    const topDest = Object.entries(destMap).sort((a, b) => b[1] - a[1])
    const topDestPct = topDest.length > 0 ? Math.round((topDest[0][1] / movements.length) * 100) : 0

    // ── Purposes ──
    const purposeMap = {}
    movements.forEach(m => { if (m.purpose) purposeMap[m.purpose] = (purposeMap[m.purpose] || 0) + 1 })
    const topPurpose = Object.entries(purposeMap).sort((a, b) => b[1] - a[1])

    // ── Normal hours (per plate/visitor history) ──
    const plateHours = {}
    movements.filter(m => m.plate_number).forEach(m => {
      const h = new Date(m.entry_time).getHours()
      if (!plateHours[m.plate_number]) plateHours[m.plate_number] = []
      plateHours[m.plate_number].push(h)
    })

    // Off-hours movements (before 6am or after 10pm)
    const offHours = movements.filter(m => {
      const h = new Date(m.entry_time).getHours()
      return h < 6 || h >= 22
    })

    // ── Multi-name plates ──
    const plateNames = {}
    movements.filter(m => m.plate_number && m.visitor_name).forEach(m => {
      if (!plateNames[m.plate_number]) plateNames[m.plate_number] = new Set()
      plateNames[m.plate_number].add(m.visitor_name.trim().toLowerCase())
    })
    const multiName = Object.entries(plateNames)
      .filter(([, names]) => names.size > 1)
      .map(([plate, names]) => ({ plate, names: [...names] }))

    // ── No ID pedestrians ──
    const noId = movements.filter(m => m.type === 'pedestrian' && !m.id_number)

    // ── Incomplete records ──
    const incomplete = movements.filter(m => !m.destination || !m.purpose)

    // ── OCR stats ──
    const ocrMov = movements.filter(m => m.ocr_confidence !== null && m.ocr_confidence !== undefined)
    const avgOcr = ocrMov.length > 0 ? Math.round(mean(ocrMov.map(m => m.ocr_confidence))) : null
    const lowOcr = ocrMov.filter(m => m.ocr_confidence < 70).length

    // ── Notes ──
    const withNotes = movements.filter(m => m.notes && m.notes.trim())

    // ── New vs returning ──
    const knownPlates = new Set(repeatVisitors.filter(v => v.visit_count > 1).map(v => v.plate_number).filter(Boolean))
    const newPlates = new Set()
    const returningPlates = new Set()
    movements.filter(m => m.plate_number).forEach(m => {
      if (knownPlates.has(m.plate_number)) returningPlates.add(m.plate_number)
      else newPlates.add(m.plate_number)
    })

    // ── Enrich repeat visitors with top destination ──
    const enrichedRepeat = repeatVisitors.map(v => {
      const vMov = movements.filter(m => m.plate_number === v.plate_number || m.visitor_name === v.visitor_name)
      const dMap = {}
      vMov.forEach(m => { if (m.destination) dMap[m.destination] = (dMap[m.destination] || 0) + 1 })
      const topD = Object.entries(dMap).sort((a, b) => b[1] - a[1])[0]
      return { ...v, top_destination: topD ? topD[0] : null }
    })

    // ── Anomaly detection ──
    const anomalies = []

    // Spike days (mean + 2 SD)
    const spikeThreshold = dailyMean + 2 * dailySD
    const spikeDays = byDay.filter(d => d.total > spikeThreshold && dailySD > 0)
    spikeDays.forEach(d => {
      anomalies.push({
        level: 'warning',
        title: 'Traffic spike on ' + new Date(d.date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' }),
        body: d.total + ' movements recorded — ' + Math.round(((d.total - dailyMean) / dailyMean) * 100) + '% above the installation daily average of ' + Math.round(dailyMean) + '.',
        meta: d.flags > 0 ? d.flags + ' flag hit(s) on this day' : null
      })
    })

    // Off-hours entries
    if (offHours.length > 0) {
      anomalies.push({
        level: offHours.length > 5 ? 'warning' : 'info',
        title: offHours.length + ' movement(s) recorded outside normal hours (before 6am or after 10pm)',
        body: 'These entries occurred during periods of expected low or no activity. Review for authorisation.',
        meta: 'Most recent: ' + fmtTime(offHours[offHours.length - 1].entry_time) + ' on ' + fmt(offHours[offHours.length - 1].entry_time)
      })
    }

    // Multi-name vehicles
    if (multiName.length > 0) {
      anomalies.push({
        level: 'warning',
        title: multiName.length + ' vehicle(s) recorded with multiple different visitor names',
        body: 'Same plate, different persons logged. May indicate shared vehicles or identity inconsistencies. Recommend physical verification.',
        meta: multiName.slice(0, 3).map(m => m.plate + ' (' + m.names.length + ' names)').join(' · ')
      })
    }

    // Incomplete records
    if (incomplete.length > 0) {
      anomalies.push({
        level: incomplete.length > 10 ? 'warning' : 'info',
        title: incomplete.length + ' entr' + (incomplete.length === 1 ? 'y' : 'ies') + ' logged with missing destination or purpose',
        body: 'Incomplete records reduce the intelligence value of gate logs. Guards should be reminded to complete all fields.',
        meta: null
      })
    }

    // No-ID pedestrians
    if (noId.length > 0) {
      anomalies.push({
        level: noId.length > 5 ? 'warning' : 'info',
        title: noId.length + ' pedestrian entr' + (noId.length === 1 ? 'y' : 'ies') + ' without ID number on record',
        body: 'Unidentified pedestrian entries cannot be traced after the fact. Recommend strict ID logging at all pedestrian gates.',
        meta: null
      })
    }

    // Low OCR confidence
    if (lowOcr > 0) {
      anomalies.push({
        level: 'info',
        title: lowOcr + ' plate scan(s) with low confidence (under 70%)',
        body: 'These plate numbers may be inaccurate. Guards should manually verify low-confidence scans before admitting vehicles.',
        meta: 'Average scan confidence: ' + avgOcr + '%'
      })
    }

    if (anomalies.length === 0) {
      anomalies.push({
        level: 'ok',
        title: 'No significant anomalies detected',
        body: 'Movement patterns are within normal parameters for the analysis period.'
      })
    }

    // ── Purpose insight ──
    let purposeInsight = null
    if (topPurpose.length > 0) {
      const topP = topPurpose[0]
      const pct = Math.round((topP[1] / movements.length) * 100)
      purposeInsight = `The most common stated purpose is "${topP[0]}" accounting for ${pct}% of all entries (${topP[1]} movements).${topPurpose.length > 1 ? ' This is followed by "' + topPurpose[1][0] + '" at ' + Math.round((topPurpose[1][1] / movements.length) * 100) + '%.' : ''}`
    }

    let destInsight = null
    if (topDest.length > 0) {
      destInsight = `The most visited destination is "${topDest[0][0]}" with ${topDest[0][1]} visits (${topDestPct}% of all movements).${topDestPct > 50 ? ' This high concentration warrants attention — over half of all visitors are directed to a single location.' : ''}`
    }

    setIntel({
      empty: false,
      anomalies,
      byHour,
      byDow: dowMap,
      summary: {
        total: movements.length,
        days: byDay.length,
        dailyAvg: Math.round(dailyMean),
        peakHour: peakHour.count > 0 ? peakHour.hour : null,
        peakDay: peakDow.avg > 0 ? days[peakDow.dow] : null,
        purposeInsight,
        destInsight,
        topDest,
        topPurpose,
      },
      visitors: {
        newCount: newPlates.size,
        returningCount: returningPlates.size,
        top: enrichedRepeat.slice(0, 10),
        topRepeater: enrichedRepeat[0] || null,
        multiName,
        noId,
      },
      ops: {
        incomplete: incomplete.length,
        avgOcr,
        lowOcr,
        notesCount: withNotes.length,
        offHours: offHours.length,
      }
    })
    setLoading(false)
  }

  function downloadBrief() {
    if (!intel || intel.empty) return
    setDownloading(true)
    const html = generateBriefHTML(intel, tenant.name)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); setDownloading(false) }, 600)
  }

  const SECTIONS = [
    { key: 'anomalies', label: 'Anomalies' },
    { key: 'patterns', label: 'Patterns' },
    { key: 'visitors', label: 'Visitors' },
    { key: 'operational', label: 'Operational' },
  ]

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>Analysing movement data...</div>

  if (intel?.empty) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
      <p style={{ fontSize: '14px' }}>No movement data available for analysis yet.</p>
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Intelligence</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Automated pattern and anomaly analysis · Last 90 days</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={downloadBrief} disabled={downloading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {downloading ? 'Preparing...' : 'Download Brief'}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Movements analysed', value: intel.summary.total, color: 'var(--accent)' },
          { label: 'Active days', value: intel.summary.days, color: 'var(--text-0)' },
          { label: 'Daily average', value: intel.summary.dailyAvg, color: 'var(--text-0)' },
          { label: 'Anomalies found', value: intel.anomalies.filter(a => a.level !== 'ok').length,
            color: intel.anomalies.filter(a => a.level !== 'ok').length > 0 ? 'var(--red)' : 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '700', fontFamily: 'var(--font-display)', color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div className="filter-row" style={{ marginBottom: '16px' }}>
        {SECTIONS.map(s => (
          <button key={s.key} className={'filter-btn' + (section === s.key ? ' active' : '')} onClick={() => setSection(s.key)}>
            {s.label}
            {s.key === 'anomalies' && intel.anomalies.filter(a => a.level === 'critical' || a.level === 'warning').length > 0 && (
              <span style={{ marginLeft: '6px', background: 'var(--red)', color: 'white', borderRadius: '10px', fontSize: '9px', padding: '1px 5px', fontWeight: '700' }}>
                {intel.anomalies.filter(a => a.level === 'critical' || a.level === 'warning').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Anomalies */}
      {section === 'anomalies' && (
        <div>
          {intel.anomalies.map((a, i) => (
            <Finding key={i} level={a.level} title={a.title} body={a.body} meta={a.meta} />
          ))}
        </div>
      )}

      {/* Patterns */}
      {section === 'patterns' && (
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>Activity heatmap by hour of day</div>
            <HourHeatmap byHour={intel.byHour} />
            {intel.summary.peakHour !== null && (
              <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '10px' }}>
                Peak hour: <strong style={{ color: 'var(--accent)' }}>{hourLabel(intel.summary.peakHour)}</strong> with {intel.byHour[intel.summary.peakHour].count} movements. Darker = more activity.
              </p>
            )}
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>Average traffic by day of week</div>
            <DayChart byDow={intel.byDow} />
            {intel.summary.peakDay && (
              <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '10px' }}>
                Busiest day: <strong style={{ color: 'var(--red)' }}>{intel.summary.peakDay}</strong>. Red bar indicates peak.
              </p>
            )}
          </div>

          {intel.summary.topDest.length > 0 && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Destination concentration</div>
              {intel.summary.topDest.slice(0, 6).map(([dest, count]) => (
                <div key={dest} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-1)' }}>{dest}</span>
                    <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{count} <span style={{ color: 'var(--text-2)', fontWeight: '400' }}>({Math.round(count / intel.summary.total * 100)}%)</span></span>
                  </div>
                  <div style={{ background: 'var(--bg-2)', borderRadius: '4px', height: '7px' }}>
                    <div style={{ background: 'var(--accent)', borderRadius: '4px', height: '7px', width: (count / intel.summary.topDest[0][1] * 100) + '%' }} />
                  </div>
                </div>
              ))}
              {intel.summary.destInsight && <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '10px' }}>{intel.summary.destInsight}</p>}
            </div>
          )}

          {intel.summary.topPurpose.length > 0 && (
            <div className="card">
              <div className="section-label" style={{ marginBottom: '12px' }}>Purpose breakdown</div>
              {intel.summary.topPurpose.slice(0, 6).map(([purpose, count]) => (
                <div key={purpose} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-1)' }}>{purpose}</span>
                    <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{count}</span>
                  </div>
                  <div style={{ background: 'var(--bg-2)', borderRadius: '4px', height: '7px' }}>
                    <div style={{ background: 'var(--amber)', borderRadius: '4px', height: '7px', width: (count / intel.summary.topPurpose[0][1] * 100) + '%' }} />
                  </div>
                </div>
              ))}
              {intel.summary.purposeInsight && <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '10px' }}>{intel.summary.purposeInsight}</p>}
            </div>
          )}
        </div>
      )}

      {/* Visitors */}
      {section === 'visitors' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>First-time entries</div>
              <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{intel.visitors.newCount}</div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Returning visitors</div>
              <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--green)' }}>{intel.visitors.returningCount}</div>
            </div>
          </div>

          {intel.visitors.top.length > 0 && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>High-frequency visitors</div>
              {intel.visitors.top.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>{v.plate_number || v.visitor_name || '—'}</div>
                    {v.top_destination && <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>→ {v.top_destination}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px' }}>{v.visit_count}×</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>{fmt(v.last_visit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {intel.visitors.multiName.length > 0 && (
            <div className="card" style={{ marginBottom: '16px', borderLeft: '3px solid var(--amber)' }}>
              <div className="section-label" style={{ marginBottom: '12px', color: 'var(--amber)' }}>⚠ Multi-name vehicles</div>
              {intel.visitors.multiName.map((m, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', marginRight: '10px' }}>{m.plate}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>{m.names.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}

          {intel.visitors.noId.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="section-label" style={{ marginBottom: '8px' }}>Pedestrians without ID</div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{intel.visitors.noId.length} pedestrian entr{intel.visitors.noId.length === 1 ? 'y' : 'ies'} logged without an ID number. These cannot be traced after the fact.</p>
            </div>
          )}
        </div>
      )}

      {/* Operational */}
      {section === 'operational' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Incomplete records', value: intel.ops.incomplete, color: intel.ops.incomplete > 0 ? 'var(--amber)' : 'var(--green)' },
              { label: 'Off-hours entries', value: intel.ops.offHours, color: intel.ops.offHours > 0 ? 'var(--amber)' : 'var(--green)' },
              { label: 'Guard notes logged', value: intel.ops.notesCount, color: 'var(--text-0)' },
              { label: 'Low confidence scans', value: intel.ops.lowOcr, color: intel.ops.lowOcr > 0 ? 'var(--amber)' : 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '26px', fontWeight: '700', fontFamily: 'var(--font-display)', color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {intel.ops.avgOcr !== null && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="section-label" style={{ marginBottom: '8px' }}>Plate scan quality</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: '6px', height: '10px' }}>
                  <div style={{ background: intel.ops.avgOcr > 80 ? 'var(--green)' : intel.ops.avgOcr > 60 ? 'var(--amber)' : 'var(--red)', borderRadius: '6px', height: '10px', width: intel.ops.avgOcr + '%', transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '15px', color: 'var(--text-0)', flexShrink: 0 }}>{intel.ops.avgOcr}%</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>Average OCR confidence across all plate scans. Above 80% is optimal.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
