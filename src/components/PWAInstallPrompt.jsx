import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const location = useLocation()

  // Only show PWA install prompt on gate routes
  const isGateRoute = location.pathname.startsWith('/gate/')

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (isGateRoute) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isGateRoute])

  useEffect(() => {
    // Hide prompt if user navigates away from gate route
    if (!isGateRoute) setShow(false)
    else if (deferredPrompt) setShow(true)
  }, [isGateRoute, deferredPrompt])

  if (!show || !isGateRoute) return null

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: '#0a2218', color: 'white', borderRadius: '12px',
      padding: '14px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 1000, maxWidth: '340px', width: 'calc(100% - 32px)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', marginBottom: '2px' }}>Install SENTRi Gate</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Add to home screen for offline use</div>
      </div>
      <button onClick={install}
        style={{ background: '#4ade80', color: '#0a2218', border: 'none', borderRadius: '8px', padding: '8px 14px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
        Install
      </button>
      <button onClick={() => setShow(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px', padding: '0', lineHeight: 1 }}>
        ×
      </button>
    </div>
  )
}
