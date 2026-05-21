const fs = require('fs');
const { execSync } = require('child_process');

// Read tabs.jsx to see what's exported
const tabs = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8');
const exports = tabs.match(/export (function|const) \w+/g) || [];
console.log('Exports found in tabs.jsx:', exports);

// Fix CommandApp.jsx to import from tabs.jsx instead of individual files
const commandApp = `import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'
import { LiveTab, WatchlistTab, AlertsTab, ProfileTab } from './tabs'
import IncidentsTab from './IncidentsTab'
import ReportTab from './ReportTab'
import GatesTab from './GatesTab'

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
    const ch = supabase.channel('command-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flag_alerts', filter: 'tenant_id=eq.' + tenant.id }, fetchCounts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', filter: 'tenant_id=eq.' + tenant.id }, fetchCounts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flag_alerts', filter: 'tenant_id=eq.' + tenant.id }, fetchCounts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', filter: 'tenant_id=eq.' + tenant.id }, fetchCounts)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchCounts() {
    const [a, i] = await Promise.all([
      supabase.from('flag_alerts').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('acknowledged', false),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('status', 'open')
    ])
    setAlertCount(a.count || 0)
    setIncidentCount(i.count || 0)
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
            <div className="logo-icon">S</div>
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
          <button
            key={tab.key}
            className={'nav-tab' + (activeTab === tab.key ? ' active' : '')}
            onClick={() => setActiveTab(tab.key)}
          >
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
`;

fs.writeFileSync('src/pages/command/CommandApp.jsx', commandApp, 'utf8');
console.log('CommandApp.jsx fixed with correct imports');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix CommandApp imports - use tabs.jsx for existing components"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
