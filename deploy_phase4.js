const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Written: ' + filePath);
}

// store/index.js
write('src/store/index.js', `import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set) => ({
      officer: null,
      tenant: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,
      isOnline: navigator.onLine,

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { set({ authLoading: false, authError: authError.message }); return }
        const { data: officerData, error: officerError } = await supabase
          .from('officers').select('*, tenants(*)').eq('id', authData.user.id).eq('is_active', true).single()
        if (officerError || !officerData) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Officer profile not found.' }); return
        }
        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' }); return
        }
        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ officer: null, tenant: null, isAuthenticated: false })
      },

      setOnline: (val) => set({ isOnline: val }),
    }),
    {
      name: 'sentri-auth',
      partialize: (state) => ({ officer: state.officer, tenant: state.tenant, isAuthenticated: state.isAuthenticated }),
    }
  )
)

export const useGuardStore = create(
  persist(
    (set) => ({
      onShift: false,
      guard: null,
      gate: null,
      tenant: null,
      shiftStart: null,
      shiftLogId: null,
      activeTab: 'admit',

      setTenant: (tenant) => set({ tenant }),
      setGate: (gate) => set({ gate }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      startShift: ({ guard, shiftLogId }) => set({
        onShift: true, guard, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),

      endShift: () => set({ onShift: false, guard: null, shiftLogId: null, shiftStart: null, activeTab: 'admit' }),
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (state) => ({
        onShift: state.onShift, guard: state.guard, gate: state.gate, tenant: state.tenant,
        shiftStart: state.shiftStart, shiftLogId: state.shiftLogId, activeTab: state.activeTab,
      }),
    }
  )
)
`);

// command/CommandApp.jsx
write('src/pages/command/CommandApp.jsx', `import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'
import LiveTab from './LiveTab'
import WatchlistTab from './WatchlistTab'
import AlertsTab from './AlertsTab'
import IncidentsTab from './IncidentsTab'
import ReportTab from './ReportTab'
import GatesTab from './GatesTab'
import ProfileTab from './ProfileTab'

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'report', label: 'Report' },
  { key: 'gates', label: 'Gates' },
  { key: 'profile', label: 'Profile' },
]

export default function CommandApp() {
  const { officer, tenant, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('live')
  const [alertCount, setAlertCount] = useState(0)
  const [incidentCount, setIncidentCount] = useState(0)

  useEffect(() => {
    fetchCounts()
    const channel = supabase.channel('command-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flag_alerts', filter: \`tenant_id=eq.\${tenant.id}\` }, () => fetchCounts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', filter: \`tenant_id=eq.\${tenant.id}\` }, () => fetchCounts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flag_alerts', filter: \`tenant_id=eq.\${tenant.id}\` }, () => fetchCounts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', filter: \`tenant_id=eq.\${tenant.id}\` }, () => fetchCounts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchCounts() {
    const [alertsRes, incidentsRes] = await Promise.all([
      supabase.from('flag_alerts').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('acknowledged', false),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('status', 'open')
    ])
    setAlertCount(alertsRes.count || 0)
    setIncidentCount(incidentsRes.count || 0)
  }

  function renderTab() {
    switch (activeTab) {
      case 'live': return <LiveTab />
      case 'watchlist': return <WatchlistTab />
      case 'alerts': return <AlertsTab />
      case 'incidents': return <IncidentsTab />
      case 'report': return <ReportTab />
      case 'gates': return <GatesTab />
      case 'profile': return <ProfileTab />
      default: return <LiveTab />
    }
  }

  return (
    <div className="command-app">
      <header className="command-header">
        <div className="header-left">
          <div className="sentri-logo">
            <div className="logo-icon">SENTRi</div>
            <div>
              <div className="installation-name">{tenant?.name}</div>
              <div className="officer-info">{officer?.rank} {officer?.name} &middot; {officer?.role === 'command' ? 'Intelligence' : officer?.role}</div>
            </div>
          </div>
        </div>
        <div className="header-right">
          <span className="live-indicator">Live</span>
          <button className="btn-signout" onClick={logout}>Sign out</button>
        </div>
      </header>
      <nav className="command-nav">
        {TABS.map(tab => (
          <button key={tab.key} className={\`nav-tab \${activeTab === tab.key ? 'active' : ''}\`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tab.key === 'alerts' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
            {tab.key === 'incidents' && incidentCount > 0 && <span className="nav-badge nav-badge-red">{incidentCount}</span>}
          </button>
        ))}
      </nav>
      <main className="command-main">{renderTab()}</main>
    </div>
  )
}
`);

// command/GatesTab.jsx
write('src/pages/command/GatesTab.jsx', `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

export default function GatesTab() {
  const { tenant } = useAuthStore()
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)
  const [form, setForm] = useState({ name: '', location: '' })
  const [error, setError] = useState('')
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  useEffect(() => { fetchGates() }, [])

  async function fetchGates() {
    setLoading(true)
    const { data } = await supabase.from('gates').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true })
    setGates(data || [])
    setLoading(false)
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function createGate() {
    setError('')
    if (!form.name.trim()) { setError('Gate name is required'); return }
    const slug = slugify(form.name)
    setCreating(true)
    const { error: err } = await supabase.from('gates').insert({
      tenant_id: tenant.id, name: form.name.trim(), slug,
      location: form.location.trim() || null, is_active: true
    })
    setCreating(false)
    if (err) { setError(err.message); return }
    setForm({ name: '', location: '' })
    setShowForm(false)
    fetchGates()
  }

  async function toggleGate(gate) {
    await supabase.from('gates').update({ is_active: !gate.is_active }).eq('id', gate.id)
    fetchGates()
  }

  function copyUrl(gate) {
    navigator.clipboard.writeText(\`\${appUrl}/gate/\${tenant.slug}/\${gate.slug}\`)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="gates-tab">
      <div className="tab-header">
        <div>
          <h2>Gate Management</h2>
          <p className="tab-sub">Each gate has a unique URL. Send it to the guard device to install as a PWA.</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setError('') }}>
          {showForm ? 'Cancel' : '+ Add Gate'}
        </button>
      </div>
      {showForm && (
        <div className="card form-card">
          <h3>Create New Gate</h3>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Gate Name *</label>
              <input placeholder="e.g. Maryland Gate, Main Gate" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {form.name && <span className="slug-preview">URL: /gate/{tenant.slug}/{slugify(form.name)}</span>}
            </div>
            <div className="form-group">
              <label>Location (optional)</label>
              <input placeholder="e.g. North perimeter, Maryland Road" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" onClick={createGate} disabled={creating}>{creating ? 'Creating...' : 'Create Gate'}</button>
        </div>
      )}
      {loading ? <div className="loading-state">Loading gates...</div> : gates.length === 0 ? (
        <div className="empty-state"><p>No gates configured yet. Add your first gate above.</p></div>
      ) : (
        <div className="gates-list">
          {gates.map(gate => (
            <div key={gate.id} className={\`gate-card \${!gate.is_active ? 'gate-inactive' : ''}\`}>
              <div className="gate-info">
                <div className="gate-name-row">
                  <span className="gate-name">{gate.name}</span>
                  <span className={\`badge \${gate.is_active ? 'badge-green' : 'badge-grey'}\`}>{gate.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                {gate.location && <span className="gate-location">{gate.location}</span>}
                <div className="gate-url-row">
                  <code className="gate-url">{appUrl}/gate/{tenant.slug}/{gate.slug}</code>
                </div>
              </div>
              <div className="gate-actions">
                <button className={\`btn-copy \${copied === gate.id ? 'copied' : ''}\`} onClick={() => copyUrl(gate)}>{copied === gate.id ? 'Copied!' : 'Copy URL'}</button>
                <button className="btn-ghost" onClick={() => toggleGate(gate)}>{gate.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
`);

// command/IncidentsTab.jsx
write('src/pages/command/IncidentsTab.jsx', `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const TYPE_LABELS = {
  unauthorized_access: 'Unauthorized Access', suspicious_vehicle: 'Suspicious Vehicle',
  suspicious_person: 'Suspicious Person', altercation: 'Altercation',
  medical_emergency: 'Medical Emergency', equipment_issue: 'Equipment Issue',
  perimeter_breach: 'Perimeter Breach', contraband_detected: 'Contraband Detected', other: 'Other'
}
const SEVERITY_COLORS = { routine: 'badge-blue', serious: 'badge-amber', critical: 'badge-red' }

export default function IncidentsTab() {
  const { tenant, officer } = useAuthStore()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    fetchIncidents()
    const channel = supabase.channel('incidents-command')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', filter: \`tenant_id=eq.\${tenant.id}\` }, () => fetchIncidents())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [filter])

  async function fetchIncidents() {
    setLoading(true)
    let query = supabase.from('incidents')
      .select('*, gates(name), officers!incidents_officer_id_fkey(name, rank)')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setIncidents(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('incidents').update({
      status,
      acknowledged_by: status === 'acknowledged' ? officer.id : undefined,
      acknowledged_at: status === 'acknowledged' ? new Date().toISOString() : undefined,
      resolved_by: status === 'resolved' ? officer.id : undefined,
      resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
    }).eq('id', id)
    fetchIncidents()
  }

  const openCount = incidents.filter(i => i.status === 'open').length

  return (
    <div className="incidents-tab">
      <div className="tab-header">
        <div>
          <h2>Incidents {openCount > 0 && <span className="badge badge-red">{openCount} open</span>}</h2>
          <p className="tab-sub">All reported incidents from gate officers.</p>
        </div>
      </div>
      <div className="filter-row">
        {['open','acknowledged','resolved','all'].map(f => (
          <button key={f} className={\`filter-btn \${filter === f ? 'active' : ''}\`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <div className="loading-state">Loading incidents...</div> : incidents.length === 0 ? (
        <div className="empty-state"><p>No {filter !== 'all' ? filter : ''} incidents.</p></div>
      ) : (
        <div className="incidents-list">
          {incidents.map(inc => (
            <div key={inc.id} className={\`incident-card severity-\${inc.severity}\`}>
              <div className="incident-header">
                <div className="incident-title-row">
                  <span className="incident-type">{TYPE_LABELS[inc.type] || inc.type}</span>
                  <span className={\`badge \${SEVERITY_COLORS[inc.severity]}\`}>{inc.severity}</span>
                  <span className={\`badge \${inc.status === 'open' ? 'badge-red' : inc.status === 'acknowledged' ? 'badge-amber' : 'badge-green'}\`}>{inc.status}</span>
                </div>
                <div className="incident-meta">
                  {inc.gates?.name && <span>{inc.gates.name}</span>}
                  {inc.officers?.name && <span>{inc.officers.rank} {inc.officers.name}</span>}
                  <span>{new Date(inc.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="incident-description">{inc.description}</p>
              {inc.location && <p className="incident-location">{inc.location}</p>}
              {inc.status === 'open' && (
                <div className="incident-actions">
                  <button className="btn-amber" onClick={() => updateStatus(inc.id, 'acknowledged')}>Acknowledge</button>
                  <button className="btn-green" onClick={() => updateStatus(inc.id, 'resolved')}>Mark Resolved</button>
                </div>
              )}
              {inc.status === 'acknowledged' && (
                <div className="incident-actions">
                  <button className="btn-green" onClick={() => updateStatus(inc.id, 'resolved')}>Mark Resolved</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
`);

// command/ReportTab.jsx
write('src/pages/command/ReportTab.jsx', `import { useState, useEffect } from 'react'
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
        {PERIODS.map(p => <button key={p.key} className={\`filter-btn \${period===p.key?'active':''\`} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
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
          {data.topDestinations.length > 0 && <div className="report-section"><h3>Top Destinations</h3><div className="dest-list">{data.topDestinations.map(({dest,count})=><div className="dest-row" key={dest}><span className="dest-name">{dest}</span><div className="dest-bar-wrap"><div className="dest-bar" style={{width:\`\${(count/data.topDestinations[0].count)*100}%\`}}/></div><span className="dest-count">{count}</span></div>)}</div></div>}
          {data.byDay.length > 0 && <div className="report-section"><h3>Daily Breakdown</h3><div className="report-table"><div className="table-header"><span>Date</span><span>Total</span><span>Vehicles</span><span>Pedestrians</span><span>Flags</span></div>{data.byDay.map(d=><div className="table-row" key={d.date}><span>{new Date(d.date).toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short'})}</span><span>{d.total}</span><span>{d.vehicles}</span><span>{d.pedestrians}</span><span className={d.flags>0?'text-red':''}>{d.flags}</span></div>)}</div></div>}
          {data.repeatVisitors.length > 0 && <div className="report-section"><h3>Repeat Visitors</h3><div className="report-table"><div className="table-header"><span>Plate / Name</span><span>Visits</span><span>Last Visit</span></div>{data.repeatVisitors.map((v,i)=><div className="table-row" key={i}><span>{v.plate_number||v.visitor_name||'--'}</span><span>{v.visit_count}</span><span>{new Date(v.last_visit).toLocaleDateString()}</span></div>)}</div></div>}
        </div>
      )}
    </div>
  )
}
`);

// gate/GateApp.jsx
write('src/pages/gate/GateApp.jsx', `import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import ShiftStart from './ShiftStart'
import AdmitPage from './AdmitPage'
import CheckoutPage from './CheckoutPage'
import ShiftPage from './ShiftPage'
import GateLogPage from './GateLogPage'
import ReportIncidentPage from './ReportIncidentPage'

const TABS = [
  { key: 'admit', label: 'Admit', icon: '+' },
  { key: 'checkout', label: 'Checkout', icon: 'OK' },
  { key: 'log', label: 'Log', icon: '=' },
  { key: 'incident', label: 'Incident', icon: '!' },
  { key: 'shift', label: 'Shift', icon: 'ID' },
]

export default function GateApp() {
  const { tenantSlug, gateSlug } = useParams()
  const { onShift, gate, tenant, activeTab, setActiveTab } = useGuardStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadGate() }, [tenantSlug, gateSlug])

  async function loadGate() {
    setLoading(true)
    const { data: tenantData, error: tenantErr } = await supabase.from('tenants').select('*').eq('slug', tenantSlug).eq('is_active', true).single()
    if (tenantErr || !tenantData) { setError('Installation not found or inactive.'); setLoading(false); return }
    const { data: gateData, error: gateErr } = await supabase.from('gates').select('*').eq('tenant_id', tenantData.id).eq('slug', gateSlug).eq('is_active', true).single()
    if (gateErr || !gateData) { setError('Gate not found or inactive.'); setLoading(false); return }
    useGuardStore.getState().setTenant(tenantData)
    useGuardStore.getState().setGate(gateData)
    setLoading(false)
  }

  if (loading) return <div className="gate-loading"><p>SENTRi</p><p>Loading...</p></div>
  if (error) return <div className="gate-error"><h2>Access Denied</h2><p>{error}</p></div>
  if (!onShift) return <ShiftStart />

  function renderContent() {
    switch (activeTab) {
      case 'admit': return <AdmitPage />
      case 'checkout': return <CheckoutPage />
      case 'log': return <GateLogPage onBack={() => setActiveTab('admit')} />
      case 'incident': return <ReportIncidentPage onBack={() => setActiveTab('admit')} />
      case 'shift': return <ShiftPage />
      default: return <AdmitPage />
    }
  }

  return (
    <div className="gate-app">
      <header className="gate-header">
        <div className="gate-header-left">
          <div>
            <div className="gate-tenant-name">{tenant?.name}</div>
            <div className="gate-name-display">{gate?.name}</div>
          </div>
        </div>
      </header>
      <main className="gate-main">{renderContent()}</main>
      <nav className="gate-nav">
        {TABS.map(tab => (
          <button key={tab.key} className={\`gate-nav-btn \${activeTab === tab.key ? 'active' : ''} \${tab.key === 'incident' ? 'incident-tab' : ''}\`} onClick={() => setActiveTab(tab.key)}>
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
`);

// gate/GateLogPage.jsx
write('src/pages/gate/GateLogPage.jsx', `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

export default function GateLogPage({ onBack }) {
  const { gate, tenant } = useGuardStore()
  const [period, setPeriod] = useState('today')
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchMovements() }, [period])

  async function fetchMovements() {
    setLoading(true)
    let since
    if (period === 'today') {
      const today = new Date(); today.setHours(0,0,0,0); since = today.toISOString()
    } else {
      since = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    }
    const { data } = await supabase.from('movements')
      .select('*, entry_officer:officers!movements_entry_officer_id_fkey(name,rank), exit_officer:officers!movements_exit_officer_id_fkey(name,rank)')
      .eq('tenant_id', tenant.id).eq('gate_id', gate.id).gte('entry_time', since).order('entry_time', { ascending: false })
    setMovements(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? movements
    : filter === 'inside' ? movements.filter(m => !m.exit_time)
    : filter === 'flagged' ? movements.filter(m => m.flag_triggered)
    : movements.filter(m => m.type === filter)

  return (
    <div className="gate-log-page">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h2>Gate Log — {gate?.name}</h2>
      </div>
      <div className="period-toggle">
        {[{key:'today',label:'Today'},{key:'week',label:'This Week'}].map(p => (
          <button key={p.key} className={\`period-btn \${period===p.key?'active':''\`} onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>
      <div className="log-summary">
        <div className="log-stat"><span className="log-stat-value">{movements.length}</span><span className="log-stat-label">Total</span></div>
        <div className="log-stat"><span className="log-stat-value green">{movements.filter(m=>!m.exit_time).length}</span><span className="log-stat-label">Inside</span></div>
        <div className="log-stat"><span className="log-stat-value red">{movements.filter(m=>m.flag_triggered).length}</span><span className="log-stat-label">Flagged</span></div>
      </div>
      <div className="filter-row">
        {['all','vehicle','pedestrian','inside','flagged'].map(f => (
          <button key={f} className={\`filter-btn \${filter===f?'active':''\`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
      </div>
      {loading ? <div className="loading-state">Loading...</div> : filtered.length === 0 ? <div className="empty-state">No entries.</div> : (
        <div className="log-list">
          {filtered.map(m => (
            <div key={m.id} className={\`log-entry \${m.flag_triggered?'flagged':''} \${!m.exit_time?'inside':''\`}>
              <div className="log-entry-header">
                <div className="log-entry-id">{m.type==='vehicle'?'Vehicle':'Person'}: {m.plate_number||m.visitor_name||'Unknown'}{m.flag_triggered&&<span className="flag-indicator"> FLAGGED</span>}</div>
                <div className="log-entry-time">{new Date(m.entry_time).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'})}{period==='week'&&<span> {new Date(m.entry_time).toLocaleDateString('en-NG',{weekday:'short',day:'numeric'})}</span>}</div>
              </div>
              <div className="log-entry-details"><span>{m.destination}</span><span> / {m.purpose}</span>{m.occupants>1&&<span> / {m.occupants} pax</span>}</div>
              <div className="log-entry-footer">
                <span className={\`log-status \${!m.exit_time?'inside':'exited'\`}>{!m.exit_time?'Still inside':\`Exited \${m.duration_minutes}m\`}</span>
                {m.entry_officer?.name&&<span className="log-officer">{m.entry_officer.rank} {m.entry_officer.name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
`);

// gate/ReportIncidentPage.jsx
write('src/pages/gate/ReportIncidentPage.jsx', `import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

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
  { value: 'routine', label: 'Routine', desc: 'Minor, for record only', color: '#1a56db' },
  { value: 'serious', label: 'Serious', desc: 'Requires attention', color: '#92530a' },
  { value: 'critical', label: 'CRITICAL', desc: 'Immediate response needed', color: '#c0132a' },
]

export default function ReportIncidentPage({ onBack }) {
  const { guard, gate, tenant } = useGuardStore()
  const [form, setForm] = useState({ type: '', severity: '', description: '', location: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submitIncident() {
    setError('')
    if (!form.type) { setError('Select an incident type'); return }
    if (!form.severity) { setError('Select severity level'); return }
    if (!form.description.trim()) { setError('Description is required'); return }
    setSubmitting(true)
    const { data: officerData } = await supabase.from('officers').select('id').eq('tenant_id', tenant.id).eq('service_number', guard.serviceNumber).single()
    const { error: err } = await supabase.from('incidents').insert({
      tenant_id: tenant.id, gate_id: gate.id, officer_id: officerData?.id || null,
      type: form.type, severity: form.severity, description: form.description.trim(),
      location: form.location.trim() || null, status: 'open'
    })
    setSubmitting(false)
    if (err) { setError(err.message); return }
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="incident-submitted">
      <h2>Incident Reported</h2>
      <p>Your report has been submitted and the duty officer has been notified.</p>
      {form.severity === 'critical' && <div className="critical-notice">CRITICAL — Command alerted immediately.</div>}
      <button className="btn-primary" onClick={onBack}>Back to Gate</button>
    </div>
  )

  return (
    <div className="report-incident-page">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h2>Report Incident</h2>
        <p>{gate?.name} / {guard?.name}</p>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-section">
        <label>Incident Type *</label>
        <div className="type-grid">
          {INCIDENT_TYPES.map(t => (
            <button key={t.value} className={\`type-btn \${form.type===t.value?'selected':''\`} onClick={() => setForm(f => ({ ...f, type: t.value }))}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <label>Severity *</label>
        <div className="severity-grid">
          {SEVERITIES.map(s => (
            <button key={s.value} className={\`severity-btn \${form.severity===s.value?'selected':''\`}
              style={form.severity===s.value?{borderColor:s.color,background:s.color+'15'}:{}}
              onClick={() => setForm(f => ({ ...f, severity: s.value }))}>
              <span style={{color:s.color}}>{s.label}</span>
              <span className="severity-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <label>Description *</label>
        <textarea placeholder="Describe what happened..." rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="form-section">
        <label>Specific Location (optional)</label>
        <input placeholder="e.g. Gate entrance, North fence" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
      </div>
      <button className={\`btn-submit-incident \${form.severity==='critical'?'critical':''\`} onClick={submitIncident} disabled={submitting}>
        {submitting ? 'Submitting...' : form.severity==='critical' ? 'Submit CRITICAL Incident' : 'Submit Incident Report'}
      </button>
    </div>
  )
}
`);

// admin/AdminApp.jsx - write from file
const adminContent = fs.readFileSync('deploy_phase4.ps1', 'utf8');
// We'll use a separate approach - write AdminApp directly
write('src/pages/admin/AdminApp.jsx', `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET
const SECTORS = ['military', 'oil_gas', 'industrial', 'corporate', 'government', 'other']
const BRANCHES = ['army', 'navy', 'airforce', 'police', 'dss']

export default function AdminApp() {
  const [authed, setAuthed] = useState(false)
  const [secret, setSecret] = useState('')
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  function login() {
    if (secret === ADMIN_SECRET) { setAuthed(true) } else { setAuthError('Invalid superadmin key') }
  }

  if (!authed) return (
    <div className="admin-login">
      <div className="admin-login-card">
        <h1>SENTRi</h1>
        <p>IGATA Superadmin</p>
        {authError && <div className="error-msg">{authError}</div>}
        <input type="password" placeholder="Superadmin key" value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
        <button className="btn-primary" onClick={login}>Access Superadmin</button>
      </div>
    </div>
  )

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div><div className="admin-title">SENTRi Superadmin</div><div className="admin-sub">IGATA Technologies</div></div>
        <button className="btn-signout" onClick={() => setAuthed(false)}>Sign out</button>
      </header>
      <nav className="admin-nav">
        {['overview','tenants','officers','incidents','settings'].map(tab => (
          <button key={tab} className={\`nav-tab \${activeTab===tab?'active':''\`} onClick={() => setActiveTab(tab)}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
        ))}
      </nav>
      <main className="admin-main">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'officers' && <OfficersTab />}
        {activeTab === 'incidents' && <AdminIncidentsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    Promise.all([
      supabase.from('tenants').select('id,name,is_active,sector'),
      supabase.from('movements').select('id,exit_time'),
      supabase.from('incidents').select('id,severity,status'),
      supabase.from('officers').select('id',{count:'exact'}),
      supabase.from('gates').select('id,is_active'),
    ]).then(([t,m,i,o,g]) => setStats({
      totalTenants:(t.data||[]).length, activeTenants:(t.data||[]).filter(x=>x.is_active).length,
      totalMovements:(m.data||[]).length, insideNow:(m.data||[]).filter(x=>!x.exit_time).length,
      openIncidents:(i.data||[]).filter(x=>x.status==='open').length,
      criticalIncidents:(i.data||[]).filter(x=>x.severity==='critical'&&x.status==='open').length,
      totalOfficers:o.count||0, activeGates:(g.data||[]).filter(x=>x.is_active).length,
      tenants:t.data||[]
    }))
  },[])
  if (!stats) return <div className="loading-state">Loading...</div>
  return (
    <div className="overview-tab">
      <h2>Platform Overview</h2>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Active Tenants</div><div className="stat-value">{stats.activeTenants}/{stats.totalTenants}</div></div>
        <div className="stat-card"><div className="stat-label">Total Movements</div><div className="stat-value">{stats.totalMovements}</div></div>
        <div className="stat-card"><div className="stat-label">Currently Inside</div><div className="stat-value green">{stats.insideNow}</div></div>
        <div className="stat-card"><div className="stat-label">Active Gates</div><div className="stat-value">{stats.activeGates}</div></div>
        <div className="stat-card"><div className="stat-label">Total Officers</div><div className="stat-value">{stats.totalOfficers}</div></div>
        <div className="stat-card"><div className="stat-label">Open Incidents</div><div className="stat-value stat-amber">{stats.openIncidents}</div></div>
        {stats.criticalIncidents>0&&<div className="stat-card"><div className="stat-label">CRITICAL Open</div><div className="stat-value stat-red">{stats.criticalIncidents}</div></div>}
      </div>
      <h3>All Tenants</h3>
      <div className="report-table">
        <div className="table-header"><span>Installation</span><span>Sector</span><span>Status</span></div>
        {stats.tenants.map(t=><div className="table-row" key={t.id}><span>{t.name}</span><span>{t.sector}</span><span className={t.is_active?'text-green':'text-red'}>{t.is_active?'Active':'Inactive'}</span></div>)}
      </div>
    </div>
  )
}

function TenantsTab() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({name:'',slug:'',sector:'',branch:'',city:'',state:'',country:'Nigeria',contact_name:'',contact_email:'',contact_phone:'',report_emails:'',report_frequency:'weekly'})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(()=>{fetch_()},[])
  async function fetch_(){setLoading(true);const{data}=await supabase.from('tenants').select('*').order('created_at');setTenants(data||[]);setLoading(false)}
  function slugify(n){return n.toLowerCase().trim().replace(/\\s+/g,'-').replace(/[^a-z0-9-]/g,'')}
  async function save(){
    setError('')
    if(!form.name.trim()){setError('Name required');return}
    const slug=form.slug||slugify(form.name)
    setSaving(true)
    const payload={...form,slug,report_emails:form.report_emails?form.report_emails.split(',').map(e=>e.trim()).filter(Boolean):[],branch:form.branch||null}
    const{error:err}=selected?await supabase.from('tenants').update(payload).eq('id',selected.id):await supabase.from('tenants').insert(payload)
    setSaving(false)
    if(err){setError(err.message);return}
    setShowForm(false);setSelected(null);setForm({name:'',slug:'',sector:'',branch:'',city:'',state:'',country:'Nigeria',contact_name:'',contact_email:'',contact_phone:'',report_emails:'',report_frequency:'weekly'});fetch_()
  }
  async function toggle(t){await supabase.from('tenants').update({is_active:!t.is_active}).eq('id',t.id);fetch_()}
  function edit(t){setSelected(t);setForm({name:t.name,slug:t.slug,sector:t.sector||'',branch:t.branch||'',city:t.city||'',state:t.state||'',country:t.country||'Nigeria',contact_name:t.contact_name||'',contact_email:t.contact_email||'',contact_phone:t.contact_phone||'',report_emails:(t.report_emails||[]).join(', '),report_frequency:t.report_frequency||'weekly'});setShowForm(true)}
  return (
    <div className="tenants-tab">
      <div className="tab-header"><h2>Tenants ({tenants.length})</h2><button className="btn-primary" onClick={()=>{setShowForm(!showForm);setSelected(null);setError('')}}>{showForm?'Cancel':'+ Onboard Client'}</button></div>
      {showForm&&<div className="card form-card">
        <h3>{selected?'Edit':'Onboard New Client'}</h3>
        {error&&<div className="error-msg">{error}</div>}
        <div className="form-grid">
          <div className="form-group"><label>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          <div className="form-group"><label>Slug</label><input value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} placeholder="auto-generated"/></div>
          <div className="form-group"><label>Sector</label><select value={form.sector} onChange={e=>setForm(f=>({...f,sector:e.target.value}))}><option value="">Select</option>{SECTORS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div className="form-group"><label>Branch</label><select value={form.branch} onChange={e=>setForm(f=>({...f,branch:e.target.value}))}><option value="">N/A</option>{BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
          <div className="form-group"><label>City</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
          <div className="form-group"><label>State</label><input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))}/></div>
          <div className="form-group"><label>Contact Name</label><input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))}/></div>
          <div className="form-group"><label>Contact Email</label><input value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))}/></div>
          <div className="form-group"><label>Contact Phone</label><input value={form.contact_phone} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))}/></div>
          <div className="form-group"><label>Report Emails</label><input value={form.report_emails} onChange={e=>setForm(f=>({...f,report_emails:e.target.value}))} placeholder="comma-separated"/></div>
          <div className="form-group"><label>Report Frequency</label><select value={form.report_frequency} onChange={e=>setForm(f=>({...f,report_frequency:e.target.value}))}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="both">Both</option></select></div>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':selected?'Update':'Create'}</button>
      </div>}
      {loading?<div className="loading-state">Loading...</div>:<div className="tenants-list">{tenants.map(t=>(
        <div key={t.id} className={\`tenant-card \${!t.is_active?'inactive':''\`}>
          <div className="tenant-info">
            <div className="tenant-name-row"><span className="tenant-name">{t.name}</span><span className={\`badge \${t.is_active?'badge-green':'badge-grey'\`}>{t.is_active?'Active':'Inactive'}</span>{t.sector&&<span className="badge badge-blue">{t.sector}</span>}</div>
            <div className="tenant-meta"><span>/{t.slug}</span>{t.city&&<span> / {t.city}, {t.state}</span>}</div>
          </div>
          <div className="tenant-actions"><button className="btn-ghost" onClick={()=>edit(t)}>Edit</button><button className="btn-ghost" onClick={()=>toggle(t)}>{t.is_active?'Deactivate':'Activate'}</button></div>
        </div>
      ))}</div>}
    </div>
  )
}

function OfficersTab() {
  const [officers, setOfficers] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTenant, setFilterTenant] = useState('all')
  useEffect(()=>{
    Promise.all([
      supabase.from('officers').select('*, tenants(name)').order('created_at',{ascending:false}),
      supabase.from('tenants').select('id,name').eq('is_active',true)
    ]).then(([o,t])=>{setOfficers(o.data||[]);setTenants(t.data||[]);setLoading(false)})
  },[])
  async function toggle(o){await supabase.from('officers').update({is_active:!o.is_active}).eq('id',o.id);const{data}=await supabase.from('officers').select('*, tenants(name)').order('created_at',{ascending:false});setOfficers(data||[])}
  const filtered=filterTenant==='all'?officers:officers.filter(o=>o.tenant_id===filterTenant)
  return (
    <div className="officers-tab">
      <div className="tab-header"><h2>Officers ({filtered.length})</h2><select value={filterTenant} onChange={e=>setFilterTenant(e.target.value)}><option value="all">All Tenants</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      {loading?<div className="loading-state">Loading...</div>:(
        <div className="report-table">
          <div className="table-header"><span>Name</span><span>Tenant</span><span>Role</span><span>Service No</span><span>Status</span><span>Actions</span></div>
          {filtered.map(o=>(
            <div className="table-row" key={o.id}>
              <span>{o.rank} {o.name}</span><span>{o.tenants?.name}</span><span>{o.role}</span><span>{o.service_number}</span>
              <span className={o.is_active?'text-green':'text-red'}>{o.is_active?'Active':'Inactive'}</span>
              <span><button className="btn-xs" onClick={()=>toggle(o)}>{o.is_active?'Deactivate':'Activate'}</button></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminIncidentsTab() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  useEffect(()=>{
    setLoading(true)
    let q=supabase.from('incidents').select('*, tenants(name), gates(name), officers!incidents_officer_id_fkey(name,rank)').order('created_at',{ascending:false})
    if(filter!=='all') q=q.eq('status',filter)
    q.then(({data})=>{setIncidents(data||[]);setLoading(false)})
  },[filter])
  return (
    <div className="incidents-tab">
      <div className="tab-header"><h2>All Incidents</h2></div>
      <div className="filter-row">{['open','acknowledged','resolved','all'].map(f=><button key={f} className={\`filter-btn \${filter===f?'active':''\`} onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>)}</div>
      {loading?<div className="loading-state">Loading...</div>:(
        <div className="incidents-list">{incidents.map(inc=>(
          <div key={inc.id} className={\`incident-card severity-\${inc.severity}\`}>
            <div className="incident-header">
              <div className="incident-title-row"><span className="incident-type">{inc.type.replace(/_/g,' ')}</span><span className={\`badge \${inc.severity==='critical'?'badge-red':inc.severity==='serious'?'badge-amber':'badge-blue'\`}>{inc.severity}</span><span className={\`badge \${inc.status==='open'?'badge-red':inc.status==='acknowledged'?'badge-amber':'badge-green'\`}>{inc.status}</span></div>
              <div className="incident-meta"><span>{inc.tenants?.name}</span>{inc.gates?.name&&<span> / {inc.gates.name}</span>}<span> / {new Date(inc.created_at).toLocaleString()}</span></div>
            </div>
            <p className="incident-description">{inc.description}</p>
          </div>
        ))}</div>
      )}
    </div>
  )
}

function SettingsTab() {
  return (
    <div className="settings-tab">
      <h2>Platform Settings</h2>
      <div className="card"><h3>About SENTRi</h3><p>Version 1.0 — Phase 4</p><p>Built by IGATA Technologies</p></div>
      <div className="card"><h3>Email Alerts</h3><p>Incident notifications via Nodemailer — Phase 6.</p></div>
    </div>
  )
}
`);

// Commit and push
console.log('\nCommitting and pushing to GitHub...');
try {
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "Phase 4 - Gates, Incidents, Log, Superadmin, Report periods"', { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('\nPhase 4 deployed successfully!');
  console.log('Netlify will auto-deploy in 30 seconds.');
} catch(e) {
  console.error('Git error:', e.message);
}
