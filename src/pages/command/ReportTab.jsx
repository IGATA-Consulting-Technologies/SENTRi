import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const PERIODS = [
  { key: 'weekly', label: 'This Week', days: 7 },
  { key: 'monthly', label: 'This Month', days: 30 },
  { key: 'quarterly', label: 'This Quarter', days: 90 },
  { key: 'annually', label: 'This Year', days: 365 },
]

export default function ReportTab() {
  const { tenant } = useAuthStore()
  const [period, setPeriod] = useState('monthly')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReport() }, [period])

  async function fetchReport() {
    setLoading(true)
    const days = PERIODS.find(p => p.key === period)?.days || 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const [movementsRes, incidentsRes, repeatRes] = await Promise.all([
      supabase.from('movements').select('id,type,entry_time,exit_time,duration_minutes,flag_triggered,destination,gate_id,gates(name)').eq('tenant_id', tenant.id).gte('entry_time', since),
      supabase.from('incidents').select('id,type,severity,status,created_at').eq('tenant_id', tenant.id).gte('created_at', since),
      supabase.from('v_repeat_visitors').select('*').eq('tenant_id', tenant.id).order('visit_count', { ascending: false }).limit(10)
    ])
    const movements = movementsRes.data || []
    const incidents = incidentsRes.data || []
    const byDay = {}
    movements.forEach(m => {
      const day = m.entry_time.split('T')[0]
      if (!byDay[day]) byDay[day] = { date: day, total: 0, vehicles: 0, pedestrians: 0, flags: 0 }
      byDay[day].total++
      if (m.type === 'vehicle') byDay[day].vehicles++; else byDay[day].pedestrians++
      if (m.flag_triggered) byDay[day].flags++
    })
    const destCount = {}
    movements.forEach(m => { if (m.destination) destCount[m.destination] = (destCount[m.destination] || 0) + 1 })
    const topDestinations = Object.entries(destCount).sort((a,b) => b[1]-a[1]).slice(0,8).map(([dest,count]) => ({dest,count}))
    const byGate = {}
    movements.forEach(m => {
      const name = m.gates?.name || 'Unknown'
      if (!byGate[name]) byGate[name] = { name, total: 0, vehicles: 0, pedestrians: 0 }
      byGate[name].total++
      if (m.type === 'vehicle') byGate[name].vehicles++; else byGate[name].pedestrians++
    })
    const dur = movements.filter(m => m.duration_minutes)
    const avgDuration = dur.length > 0 ? Math.round(dur.reduce((s,m) => s+m.duration_minutes,0)/dur.length) : null
    setData({ total: movements.length, vehicles: movements.filter(m=>m.type==='vehicle').length, pedestrians: movements.filter(m=>m.type==='pedestrian').length, flags: movements.filter(m=>m.flag_triggered).length, avgDuration, byDay: Object.values(byDay).sort((a,b)=>b.date.localeCompare(a.date)), topDestinations, byGate: Object.values(byGate), incidents: incidents.length, criticalIncidents: incidents.filter(i=>i.severity==='critical').length, repeatVisitors: repeatRes.data||[] })
    setLoading(false)
  }

  return (
    <div className="report-tab">
      <div className="tab-header"><div><h2>Intelligence Report</h2><p className="tab-sub">Movement analytics for {tenant.name}</p></div></div>
      <div className="filter-row">
        {PERIODS.map(p => <button key={p.key} className={`filter-btn ${period===p.key?'active':''`} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
      </div>
      {loading ? <div className="loading-state">Generating report...</div> : !data ? null : (
        <div className="report-content">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{data.total}</div></div>
            <div className="stat-card"><div className="stat-label">Vehicles</div><div className="stat-value">{data.vehicles}</div></div>
            <div className="stat-card"><div className="stat-label">Pedestrians</div><div className="stat-value">{data.pedestrians}</div></div>
            <div className="stat-card"><div className="stat-label">Flags</div><div className="stat-value stat-red">{data.flags}</div></div>
            <div className="stat-card"><div className="stat-label">Incidents</div><div className="stat-value stat-amber">{data.incidents}</div></div>
            <div className="stat-card"><div className="stat-label">Critical</div><div className="stat-value stat-red">{data.criticalIncidents}</div></div>
            {data.avgDuration && <div className="stat-card"><div className="stat-label">Avg Stay</div><div className="stat-value">{data.avgDuration}m</div></div>}
          </div>
          {data.byGate.length > 0 && <div className="report-section"><h3>By Gate</h3><div className="report-table"><div className="table-header"><span>Gate</span><span>Total</span><span>Vehicles</span><span>Pedestrians</span></div>{data.byGate.map(g=><div className="table-row" key={g.name}><span>{g.name}</span><span>{g.total}</span><span>{g.vehicles}</span><span>{g.pedestrians}</span></div>)}</div></div>}
          {data.topDestinations.length > 0 && <div className="report-section"><h3>Top Destinations</h3><div className="dest-list">{data.topDestinations.map(({dest,count})=><div className="dest-row" key={dest}><span className="dest-name">{dest}</span><div className="dest-bar-wrap"><div className="dest-bar" style={{width:`${(count/data.topDestinations[0].count)*100}%`}}/></div><span className="dest-count">{count}</span></div>)}</div></div>}
          {data.byDay.length > 0 && <div className="report-section"><h3>Daily Breakdown</h3><div className="report-table"><div className="table-header"><span>Date</span><span>Total</span><span>Vehicles</span><span>Pedestrians</span><span>Flags</span></div>{data.byDay.map(d=><div className="table-row" key={d.date}><span>{new Date(d.date).toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short'})}</span><span>{d.total}</span><span>{d.vehicles}</span><span>{d.pedestrians}</span><span className={d.flags>0?'text-red':''}>{d.flags}</span></div>)}</div></div>}
          {data.repeatVisitors.length > 0 && <div className="report-section"><h3>Repeat Visitors</h3><div className="report-table"><div className="table-header"><span>Plate / Name</span><span>Visits</span><span>Last Visit</span></div>{data.repeatVisitors.map((v,i)=><div className="table-row" key={i}><span>{v.plate_number||v.visitor_name||'--'}</span><span>{v.visit_count}</span><span>{new Date(v.last_visit).toLocaleDateString()}</span></div>)}</div></div>}
        </div>
      )}
    </div>
  )
}
