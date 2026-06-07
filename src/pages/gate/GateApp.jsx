import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import { getUnsyncedMovements, markSynced } from '../../lib/offline'
import ShiftStart from './ShiftStart'
import AdmitPage from './AdmitPage'
import CheckoutPage from './CheckoutPage'
import ShiftPage from './ShiftPage'
import GateLogPage from './GateLogPage'
import ReportIncidentPage from './ReportIncidentPage'

const TABS = [
  { key: 'admit', label: 'Admit', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  )},
  { key: 'checkout', label: 'Out', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
  )},
  { key: 'log', label: 'Log', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  )},
  { key: 'incident', label: 'Report', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  )},
  { key: 'shift', label: 'Shift', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  )},
]

async function syncOfflineQueue() {
  try {
    const unsynced = await getUnsyncedMovements()
    if (!unsynced.length) return
    for (const item of unsynced) {
      const movement = item.data || item
      const { localId, synced, queuedAt, action, ...cleanMovement } = movement
      const { error } = await supabase.from('movements').insert(cleanMovement)
      if (!error) await markSynced(item.localId)
    }
  } catch (e) {
    console.error('Sync engine error:', e)
  }
}

function useGateManifest() {
  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"]')
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link) }
    link.href = '/manifest-gate.json'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0f1e')
    return () => {
      if (link) link.href = '/manifest-command.json'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#1a56db')
    }
  }, [])
}

export default function GateApp() {
  const { tenantSlug, gateSlug } = useParams()
  const { onShift, activeTab, setActiveTab, shiftLogId, endShift } = useGuardStore()

  // Local state for header display — avoids store timing race condition
  const [headerGateName, setHeaderGateName] = useState('')
  const [headerTenantName, setHeaderTenantName] = useState('')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [ending, setEnding] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const torchStreamRef = useRef(null)
  useGateManifest()

  useEffect(() => { loadGate() }, [tenantSlug, gateSlug])

  useEffect(() => {
    if (navigator.onLine) syncOfflineQueue()
    const handleOnline = () => syncOfflineQueue()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  async function toggleTorch() {
    if (torchOn) {
      try {
        const track = torchStreamRef.current?.getVideoTracks()[0]
        if (track) await track.applyConstraints({ advanced: [{ torch: false }] })
        torchStreamRef.current?.getTracks().forEach(t => t.stop())
        torchStreamRef.current = null
      } catch(e) { /* ignore */ }
      setTorchOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities ? track.getCapabilities() : {}
        if (!caps.torch) {
          stream.getTracks().forEach(t => t.stop())
          alert('Torch not supported on this device.')
          return
        }
        await track.applyConstraints({ advanced: [{ torch: true }] })
        torchStreamRef.current = stream
        setTorchOn(true)
      } catch(e) {
        console.error('Torch error:', e)
        alert('Could not activate torch. Check camera permissions.')
      }
    }
  }

  async function loadGate(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    useGuardStore.getState().setTenant(null)
    useGuardStore.getState().setGate(null)

    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants').select('*').eq('slug', tenantSlug).eq('is_active', true).single()
    if (tenantErr || !tenantData) {
      setError('Installation not found or inactive.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: gateData, error: gateErr } = await supabase
      .from('gates').select('*').eq('tenant_id', tenantData.id).eq('slug', gateSlug).eq('is_active', true).single()
    if (gateErr || !gateData) {
      setError('Gate not found or inactive.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Set store
    useGuardStore.getState().setTenant(tenantData)
    useGuardStore.getState().setGate(gateData)

    // Set local header state immediately — no timing issue
    setHeaderGateName(gateData.name)
    setHeaderTenantName(tenantData.name)

    // Save this gate URL so the PWA can reopen it on next launch
    try {
      localStorage.setItem('sentri-last-gate-url', window.location.pathname)
    } catch(e) { /* ignore */ }

    // Validate persisted shift belongs to this gate
    const stored = useGuardStore.getState()
    if (stored.onShift && stored.shiftGateId && stored.shiftGateId !== gateData.id) {
      console.log('Stale shift detected from different gate — clearing.')
      useGuardStore.getState().endShift()
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function handleHeaderExit() {
    setEnding(true)
    try {
      if (shiftLogId) {
        await supabase.from('shift_logs').update({
          shift_end: new Date().toISOString(),
          notes: 'Session ended at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }).eq('id', shiftLogId)
      }
    } catch (e) {
      console.error('Shift log update error:', e)
    }
    endShift()
    setShowExitConfirm(false)
    setEnding(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-0)', gap: '12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', letterSpacing: '0.12em', color: 'var(--accent)' }}>SENTRi</div>
      <div className="spinner" style={{ width: '20px', height: '20px' }} />
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Access Denied</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '20px' }}>{error}</p>
      <button onClick={() => { setError(''); loadGate() }}
        style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: 'var(--font-display)', fontWeight: '600', cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '-webkit-fill-available', background: 'var(--bg-0)', overflow: 'hidden' }}>

      <header style={{ background: '#0a2218', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>

        {/* Refresh button — top left */}
        <button
          onClick={() => loadGate(true)}
          disabled={refreshing}
          title="Refresh"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            width: '34px', height: '34px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>

        {/* Torch button */}
        <button
          onClick={toggleTorch}
          title={torchOn ? 'Turn off torch' : 'Turn on torch'}
          style={{
            background: torchOn ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.06)',
            border: '1px solid ' + (torchOn ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.12)'),
            borderRadius: '8px', width: '34px', height: '34px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all 0.2s'
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={torchOn ? '#facc15' : 'none'}
            stroke={torchOn ? '#facc15' : 'rgba(255,255,255,0.6)'}
            strokeWidth="2" strokeLinecap="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </button>

        {/* Gate and tenant name — centre */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', color: '#4ade80', textTransform: 'uppercase' }}>SENTRi</div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'white', marginTop: '1px' }}>
            {headerGateName || '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
            {headerTenantName || '—'}
          </div>
        </div>

        {/* Exit button — top right */}
        <button
          onClick={() => setShowExitConfirm(true)}
          title="End shift"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0
          }}
          onTouchStart={e => e.currentTarget.style.background = 'rgba(192,19,42,0.3)'}
          onTouchEnd={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</main>

      <nav style={{ display: 'flex', background: 'var(--bg-1)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px 8px', border: 'none', cursor: 'pointer', gap: '3px', fontSize: '10px',
              fontFamily: 'var(--font-display)', fontWeight: '600', letterSpacing: '0.03em', transition: 'all 0.15s',
              background: activeTab === tab.key ? 'rgba(14,124,58,0.1)' : 'transparent',
              color: activeTab === tab.key ? 'var(--green)' : tab.key === 'incident' ? 'var(--red)' : 'var(--text-2)',
              borderTop: activeTab === tab.key ? '2px solid var(--green)' : '2px solid transparent'
            }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {showExitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: 'var(--bg-1)', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }} className="fade-up">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(192,19,42,0.12)', border: '1.5px solid rgba(192,19,42,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c0132a" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>End your shift?</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                Your shift will be closed and logged. Use the Shift tab to record a handover to the incoming guard.
              </p>
            </div>
            <button onClick={handleHeaderExit} disabled={ending}
              style={{ width: '100%', padding: '14px', marginBottom: '10px', background: '#c0132a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-display)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {ending ? <><div className="spinner" style={{ width: '16px', height: '16px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Ending shift...</> : 'Yes, end my shift'}
            </button>
            <button onClick={() => setShowExitConfirm(false)}
              style={{ width: '100%', padding: '13px', background: 'transparent', color: 'var(--text-2)', border: '1.5px solid var(--border-med)', borderRadius: '12px', fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
