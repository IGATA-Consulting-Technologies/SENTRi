import { useEffect, useState } from 'react'
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
          <button key={tab.key} className={`gate-nav-btn ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'incident' ? 'incident-tab' : ''}`} onClick={() => setActiveTab(tab.key)}>
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
