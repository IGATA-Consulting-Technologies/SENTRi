import { useEffect, useState } from 'react'
import { useGuardStore } from '../../store'
import { supabase } from '../../lib/supabase'
import ShiftStart from './ShiftStart'
import AdmitPage from './AdmitPage'
import CheckoutPage from './CheckoutPage'
import ShiftPage from './ShiftPage'

const TABS = [
  { id: 'admit', label: 'Admit', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { id: 'checkout', label: 'Checkout', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> },
  { id: 'shift', label: 'Shift', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
]

export default function GateApp({ tenantSlug, gateSlug }) {
  const { onShift, guard, gate, tenant, activeTab, setActiveTab, isOnline, setOnline, startShift } = useGuardStore()
  const [loading, setLoading] = useState(true)
  const [gateData, setGateData] = useState(null)
  const [tenantData, setTenantData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
    loadGateData()
  }, [tenantSlug, gateSlug])

  async function loadGateData() {
    try {
      const { data: t } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .single()

      if (!t) { setError('Installation not found.'); setLoading(false); return }

      const { data: g } = await supabase
        .from('gates')
        .select('*')
        .eq('tenant_id', t.id)
        .eq('slug', gateSlug)
        .eq('is_active', true)
        .single()

      if (!g) { setError('Gate not found.'); setLoading(false); return }

      setTenantData(t)
      setGateData(g)
    } catch (e) {
      setError('Unable to load gate data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>SENTRi</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>Loading gate...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-0)' }}>
      <div className="card" style={{ maxWidth: '360px', textAlign: 'center', padding: '32px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', marginBottom: '8px' }}>Gate not found</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{error}</p>
      </div>
    </div>
  )

  if (!onShift) return <ShiftStart gateData={gateData} tenantData={tenantData} />

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {tenant?.logo_url
            ? <img src={tenant.logo_url} alt="logo" style={{ width: '30px', height: '30px', borderRadius: '7px', objectFit: 'cover' }} />
            : <div style={{ width: '30px', height: '30px', background: 'var(--accent)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
          }
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', lineHeight: 1 }}>
              {gate?.name || gateData?.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>
              {guard?.rank} {guard?.name?.split(' ')[0]}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className={isOnline ? 'online-dot' : 'offline-dot'} />
          <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: '70px' }}>
        {activeTab === 'admit' && <AdmitPage gateData={gateData} tenantData={tenantData} />}
        {activeTab === 'checkout' && <CheckoutPage gateData={gateData} tenantData={tenantData} />}
        {activeTab === 'shift' && <ShiftPage gateData={gateData} tenantData={tenantData} />}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`bottom-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
