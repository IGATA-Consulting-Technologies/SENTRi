import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'
import { LiveTab, WatchlistTab, AlertsTab, ProfileTab } from './tabs'
import IncidentsTab from './IncidentsTab'
import ReportTab from './ReportTab'
import GatesTab from './GatesTab'
import CCTVTab from './CCTVTab'
import HistoryTab from './HistoryTab'

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'history', label: 'History' },
  { key: 'report', label: 'Report' },
  { key: 'cctv', label: 'CCTV' },
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

  // Session expiry — auto logout after 8 hours of inactivity
  useEffect(() => {
    const SESSION_LIMIT = 8 * 60 * 60 * 1000
    let lastActivity = Date.now()
    function updateActivity() { lastActivity = Date.now() }
    const checkExpiry = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_LIMIT) {
        clearInterval(checkExpiry)
        logout()
      }
    }, 60000)
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('touchstart', updateActivity)
    return () => {
      clearInterval(checkExpiry)
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('touchstart', updateActivity)
    }
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
      case 'alerts': return <AlertsTab onUnreadChange={setAlertCount} />
      case 'incidents': return <IncidentsTab onCountChange={fetchCounts} />
      case 'history': return <HistoryTab />
      case 'report': return <ReportTab />
      case 'cctv': return <CCTVTab />
      case 'gates': return <GatesTab />
      case 'profile': return <ProfileTab />
      default: return <LiveTab />
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{tenant?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            {officer?.rank} {officer?.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="online-dot" />
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '4px', padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto', background: 'var(--bg-0)'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-1)',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
              flexShrink: 0
            }}
          >
            {tab.label}
            {tab.key === 'alerts' && alertCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--red)', color: 'white',
                borderRadius: '10px', fontSize: '10px', padding: '1px 5px', fontWeight: 700
              }}>{alertCount}</span>
            )}
            {tab.key === 'incidents' && incidentCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--red)', color: 'white',
                borderRadius: '10px', fontSize: '10px', padding: '1px 5px', fontWeight: 700
              }}>{incidentCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="page-content page-content-padded">
        {renderTab()}
      </div>
    </div>
  )
}
