import { useState, useEffect } from 'react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show prompt after 3 seconds
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  if (!show || installed) return null

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div className="pwa-install-text">
        <div className="pwa-install-title">Install SENTRi</div>
        <div className="pwa-install-sub">Add to home screen for quick access</div>
      </div>
      <div className="pwa-install-actions">
        <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px', padding: '4px 8px', fontFamily: 'var(--font-display)', fontWeight: '600' }}>
          Later
        </button>
        <button onClick={install} className="btn btn-primary btn-sm">
          Install
        </button>
      </div>
    </div>
  )
}
