import { useState } from 'react'
import { useAuthStore } from '../../store'
import LiveTab from './LiveTab'
import WatchlistTab from './WatchlistTab'
import AlertsTab from './AlertsTab'
import ReportTab from './ReportTab'
import ProfileTab from './ProfileTab'
import GatesTab from './GatesTab'

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'report', label: 'Report' },
  { id: 'gates', label: 'Gates' },
  { id: 'profile', label: 'Profile' }
]

export default function CommandApp() {
  const { officer, tenant, isOnline, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('live')
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {tenant?.logo_url
            ? <img src={tenant.logo_url} alt="logo" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover' }} />
            : <div style={{ width: '34px', height: '34px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
          }
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', lineHeight: 1 }}>
              {tenant?.name || 'SENTRi Command'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>
              {officer?.rank} {officer?.name} · {officer?.role === 'admin' ? 'IGATA Admin' : 'Intelligence'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div className={isOnline ? 'online-dot' : 'offline-dot'} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{isOnline ? 'Live' : 'Offline'}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ fontSize: '12px' }}>Sign out</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: '0 0 auto', padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-2)',
            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '600',
            letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
            position: 'relative', whiteSpace: 'nowrap'
          }}>
            {tab.label}
            {tab.id === 'alerts' && unreadAlerts > 0 && (
              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '16px', height: '16px', background: 'var(--red)', borderRadius: '50%', fontSize: '9px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                {unreadAlerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '0' }}>
        {activeTab === 'live' && <LiveTab />}
        {activeTab === 'watchlist' && <WatchlistTab />}
        {activeTab === 'alerts' && <AlertsTab onUnreadChange={setUnreadAlerts} />}
        {activeTab === 'report' && <ReportTab />}
        {activeTab === 'gates' && <GatesTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </div>
    </div>
  )
}
