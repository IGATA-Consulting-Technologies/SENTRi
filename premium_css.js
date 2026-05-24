// SENTRi — Premium CSS + PWA Install Prompt
// Run with: node --input-type=commonjs < premium_css.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── PREMIUM CSS ADDITIONS (appended to existing index.css) ──────────────────

const premiumCSS = `

/* ════════════════════════════════════════════════════════
   PREMIUM UPGRADE — Desktop layout, polish, PWA prompt
   ════════════════════════════════════════════════════════ */

/* Import premium fonts */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

/* ── Enhanced root tokens ── */
:root {
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.16);
  --transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
  --accent-dark: #1446b8;
}

/* ── Desktop command dashboard layout ── */
@media (min-width: 768px) {
  .page { max-width: 1200px; margin: 0 auto; }
  .topbar { padding: 14px 28px; border-radius: 0; }
  .page-content { padding: 24px 28px; }
  .page-content-padded { padding: 24px 28px 100px; }

  /* Desktop tab nav — bigger, better spacing */
  .command-nav-tabs { padding: 10px 24px; gap: 4px; }

  /* Stats grid — 4 columns on desktop */
  .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .stat-card { padding: 20px; }
  .stat-value { font-size: 32px; }

  /* Cards breathe more on desktop */
  .card { padding: 22px; }

  /* Report table wider */
  .table-header, .table-row { padding: 12px 18px; }

  /* Incident cards */
  .incident-card { padding: 20px; }
}

@media (min-width: 1024px) {
  .page { max-width: 1280px; }
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
}

/* ── Enhanced card style ── */
.card {
  transition: var(--transition);
  border: 1px solid var(--border);
}
.card:hover { box-shadow: var(--shadow-md); }

/* ── Enhanced buttons ── */
.btn {
  transition: var(--transition);
  letter-spacing: 0.01em;
}
.btn-primary:hover { background: var(--accent-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(26,86,219,0.3); }
.btn-primary:active { transform: translateY(0); }
.btn-danger:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* ── Enhanced inputs ── */
.field input, .field select, .field textarea {
  transition: var(--transition);
}
.field input:hover, .field select:hover { border-color: var(--border-hi); }

/* ── Premium topbar ── */
.topbar {
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ── Command dashboard tab pills — premium style ── */
.command-tab-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  flex-shrink: 0;
  transition: var(--transition);
  letter-spacing: 0.01em;
}
.command-tab-btn.active {
  background: var(--accent);
  color: white;
  box-shadow: 0 2px 8px rgba(26,86,219,0.25);
}
.command-tab-btn:not(.active) {
  background: transparent;
  color: var(--text-1);
}
.command-tab-btn:not(.active):hover {
  background: var(--bg-3);
  color: var(--text-0);
}

/* ── Premium gate PWA header ── */
.gate-header {
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  padding: 10px 16px;
}
.gate-header-brand {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 1px;
}
.gate-header-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
  line-height: 1.2;
}
.gate-header-sub {
  font-size: 11px;
  color: var(--text-2);
}

/* ── Premium gate bottom nav ── */
.gate-nav { box-shadow: 0 -4px 20px rgba(0,0,0,0.08); }
.gate-nav-btn {
  transition: var(--transition);
  padding: 8px 4px 10px;
}
.gate-nav-btn.active { background: rgba(26,86,219,0.04); }
.gate-nav-btn svg { transition: var(--transition); }
.gate-nav-btn.active svg { transform: scale(1.1); }

/* ── Alert cards — premium ── */
.alert {
  border-radius: var(--radius-lg);
  font-size: 13px;
}

/* ── Incident cards — premium left border ── */
.incident-card {
  transition: var(--transition);
  border-radius: var(--radius-lg);
}
.incident-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.incident-card.severity-critical {
  background: linear-gradient(135deg, rgba(192,19,42,0.05) 0%, var(--bg-1) 50%);
}

/* ── Log entries — premium ── */
.log-entry {
  transition: var(--transition);
  border-radius: var(--radius-lg);
}
.log-entry:hover { box-shadow: var(--shadow-sm); }

/* ── Stat cards — premium ── */
.stat-card { transition: var(--transition); }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

/* ── Report section headers ── */
.report-section {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}
.report-section h3 {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

/* ── Premium form fields ── */
.field label { letter-spacing: 0.08em; }
.field input, .field select, .field textarea {
  background: var(--bg-1);
  border: 1.5px solid var(--border-med);
  font-size: 14px;
}
.field input:focus, .field select:focus, .field textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(26,86,219,0.1);
}

/* ── Gate creation form — premium ── */
.gate-form-card {
  background: var(--bg-1);
  border: 1.5px solid var(--border-med);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}
.gate-form-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-0);
}
.gate-url-box {
  background: var(--bg-2);
  border: 1px solid var(--border-med);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  word-break: break-all;
  margin-bottom: 12px;
  line-height: 1.6;
}

/* ── Checkout page cards ── */
.checkout-card {
  background: var(--bg-1);
  border: 1.5px solid var(--border-med);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
.checkout-card:hover { box-shadow: var(--shadow-md); }

/* ── Watchlist entry cards ── */
.watchlist-card {
  background: var(--bg-1);
  border: 1.5px solid rgba(192,19,42,0.2);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 8px;
  transition: var(--transition);
}
.watchlist-card:hover { box-shadow: var(--shadow-sm); }

/* ── Plates on alerts ── */
.plate {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.12em;
  background: var(--bg-3);
  border: 1.5px solid var(--border-med);
  padding: 4px 10px;
  border-radius: 6px;
  color: var(--text-0);
  font-weight: 600;
}

/* ── Scrollbar premium ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-hi); }

/* ── Mobile touch improvements ── */
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-value { font-size: 24px; }
  .field-row { grid-template-columns: 1fr; }
  .tab-header { flex-direction: column; gap: 8px; }
  .filter-row { gap: 6px; }
  .filter-btn { padding: 6px 12px; font-size: 11px; }
  .table-header, .table-row { font-size: 11px; padding: 8px 10px; }
}

/* ── PWA Install Prompt ── */
.pwa-install-banner {
  position: fixed;
  bottom: 80px;
  left: 12px;
  right: 12px;
  background: var(--bg-1);
  border: 1.5px solid var(--accent);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(26,86,219,0.2);
  z-index: 100;
  animation: slideUp 0.3s ease;
}
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.pwa-install-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: var(--accent); display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.pwa-install-text { flex: 1; }
.pwa-install-title {
  font-family: var(--font-display);
  font-size: 13px; font-weight: 700; color: var(--text-0);
  margin-bottom: 2px;
}
.pwa-install-sub { font-size: 11px; color: var(--text-2); }
.pwa-install-actions { display: flex; gap: 6px; flex-shrink: 0; }

@media (min-width: 768px) {
  .pwa-install-banner {
    bottom: 20px;
    left: auto;
    right: 20px;
    max-width: 360px;
  }
}

/* ── Admin console premium ── */
.admin-header {
  background: linear-gradient(135deg, #0f1923 0%, #1a2940 100%);
  padding: 16px 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
.admin-nav {
  background: var(--bg-1);
  border-bottom: 2px solid var(--border);
  padding: 0 20px;
}
.admin-main { padding: 24px; }

/* ── Selection and focus improvements ── */
::selection { background: var(--accent-dim); color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ── Premium section labels ── */
.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-2);
  font-family: var(--font-display);
}

/* ── Onboarding wizard premium ── */
.wizard-step-indicator {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
  font-family: var(--font-display);
  transition: var(--transition);
}
.wizard-progress-bar {
  height: 4px; border-radius: 2px;
  background: var(--bg-4);
  overflow: hidden;
}
.wizard-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #4f8ef7);
  border-radius: 2px;
  transition: width 0.4s ease;
}

/* ── Report tab — premium ── */
.report-tab { padding: 20px; }
@media (min-width: 768px) { .report-tab { padding: 24px; } }

/* ── Profile tab emails ── */
.email-recipient-card {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 8px;
  transition: var(--transition);
}
.email-recipient-card:hover { background: var(--bg-3); }

/* ── Global premium feel tweaks ── */
h1, h2, h3 { font-family: var(--font-display); }
body { font-size: 14px; }
`

// ─── PWA INSTALL PROMPT COMPONENT ────────────────────────────────────────────

const pwaPrompt = `import { useState, useEffect } from 'react'

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
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing premium CSS...')

// Append to existing CSS (don't replace — preserve all existing styles)
const existingCSS = fs.readFileSync('src/index.css', 'utf8')
if (!existingCSS.includes('PREMIUM UPGRADE')) {
  fs.writeFileSync('src/index.css', existingCSS + premiumCSS, 'utf8')
  console.log('✓ src/index.css — premium styles appended')
} else {
  console.log('✓ src/index.css — premium styles already present')
}

// Create PWA prompt component
fs.mkdirSync('src/components', { recursive: true })
fs.writeFileSync('src/components/PWAInstallPrompt.jsx', pwaPrompt, 'utf8')
console.log('✓ src/components/PWAInstallPrompt.jsx — created')

// Add PWAInstallPrompt to App.jsx
let app = fs.readFileSync('src/App.jsx', 'utf8')
if (!app.includes('PWAInstallPrompt')) {
  app = app.replace(
    "import NotFound from './pages/NotFound'",
    "import NotFound from './pages/NotFound'\nimport PWAInstallPrompt from './components/PWAInstallPrompt'"
  )
  app = app.replace(
    '    </BrowserRouter>',
    '      <PWAInstallPrompt />\n    </BrowserRouter>'
  )
  fs.writeFileSync('src/App.jsx', app, 'utf8')
  console.log('✓ App.jsx — PWAInstallPrompt added')
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const css = fs.readFileSync('src/index.css', 'utf8')
const pwa = fs.readFileSync('src/components/PWAInstallPrompt.jsx', 'utf8')
const appContent = fs.readFileSync('src/App.jsx', 'utf8')

const checks = {
  'CSS: premium tokens added': css.includes('--shadow-lg'),
  'CSS: desktop breakpoints': css.includes('min-width: 768px'),
  'CSS: PWA install banner': css.includes('pwa-install-banner'),
  'CSS: premium card hover': css.includes('card:hover'),
  'CSS: gate header brand': css.includes('gate-header-brand'),
  'CSS: mobile improvements': css.includes('max-width: 768px'),
  'CSS: font import': css.includes('fonts.googleapis.com'),
  'PWA: beforeinstallprompt': pwa.includes('beforeinstallprompt'),
  'PWA: install button': pwa.includes('deferredPrompt.prompt()'),
  'PWA: standalone check': pwa.includes('standalone'),
  'App: PWAInstallPrompt imported': appContent.includes('PWAInstallPrompt'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Premium CSS polish, desktop layout, PWA install prompt"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nTest: open sentri-igata.netlify.app on mobile Chrome')
console.log('After 3 seconds you should see the Install SENTRi banner')
