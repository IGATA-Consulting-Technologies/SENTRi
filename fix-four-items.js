const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Four fixes: officer name, sector fields, reg email, PWA split')
console.log('='.repeat(70))

// ─────────────────────────────────────────────────────────────
// 1. Fix store/index.js — startShift signature mismatch
// ─────────────────────────────────────────────────────────────
const storePath = path.join(process.cwd(), 'src', 'store', 'index.js')
let storeContent = fs.readFileSync(storePath, 'utf8').replace(/^\uFEFF/, '')

storeContent = storeContent.replace(
  `startShift: ({ guard, shiftLogId }) => set({
        onShift: true, guard, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),`,
  `startShift: (guard, gate, tenant, shiftLogId) => set({
        onShift: true, guard, gate, tenant, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),`
)

fs.writeFileSync(storePath, storeContent, 'utf8')
console.log('✓ Fixed startShift signature in store')

// ─────────────────────────────────────────────────────────────
// 2. Rewrite ShiftStart.jsx — sector-aware identity fields
// ─────────────────────────────────────────────────────────────
const shiftStartPath = path.join(process.cwd(), 'src', 'pages', 'gate', 'ShiftStart.jsx')

const shiftStartContent = `import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

// Sector config — controls what identity fields the guard sees
function getSectorConfig(sector) {
  switch (sector) {
    case 'military':
      return {
        idLabel: 'Service number',
        idPlaceholder: 'e.g. N/12345',
        idMono: true,
        showRank: true,
        rankLabel: 'Rank',
        rankPlaceholder: 'e.g. Sgt, Cpl, Lt',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => [g.rank, g.name].filter(Boolean).join(' '),
      }
    case 'oil_gas':
      return {
        idLabel: 'Staff ID',
        idPlaceholder: 'e.g. OG/12345',
        idMono: true,
        showRank: false,
        rankLabel: 'Department',
        rankPlaceholder: 'e.g. HSE, Operations',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'banking':
      return {
        idLabel: 'Staff ID',
        idPlaceholder: 'e.g. BK/00123',
        idMono: true,
        showRank: false,
        rankLabel: 'Branch / Unit',
        rankPlaceholder: 'e.g. Security, Operations',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'corporate':
      return {
        idLabel: 'Employee ID',
        idPlaceholder: 'e.g. EMP/456',
        idMono: true,
        showRank: false,
        rankLabel: 'Department',
        rankPlaceholder: 'e.g. Facilities, Security',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'government':
      return {
        idLabel: 'Staff ID / Grade',
        idPlaceholder: 'e.g. GL07/1234',
        idMono: true,
        showRank: false,
        rankLabel: 'Ministry / Agency',
        rankPlaceholder: 'e.g. Ministry of Defence',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    default:
      return {
        idLabel: 'ID number',
        idPlaceholder: 'Your ID number',
        idMono: true,
        showRank: false,
        rankLabel: 'Department / Unit',
        rankPlaceholder: 'Optional',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
  }
}

export default function ShiftStart({ gateData, tenantData }) {
  const { startShift } = useGuardStore()
  const sector = tenantData?.sector || 'other'
  const config = getSectorConfig(sector)

  const [step, setStep] = useState(1)
  const [serviceNumber, setServiceNumber] = useState('')
  const [name, setName] = useState('')
  const [rank, setRank] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [guardRecord, setGuardRecord] = useState(null)

  async function verifyIdentity() {
    if (!serviceNumber.trim() || !name.trim()) {
      setError('Please enter your ' + config.idLabel.toLowerCase() + ' and full name.')
      return
    }
    setLoading(true); setError('')
    try {
      const { data } = await supabase
        .from('officers')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('service_number', serviceNumber.trim().toUpperCase())
        .eq('is_active', true)
        .single()

      if (data) {
        const nameMatch = data.name.toLowerCase().includes(name.trim().toLowerCase().split(' ')[0].toLowerCase())
        if (!nameMatch) {
          setError('Name does not match records. Please check and try again.')
          setLoading(false); return
        }
        setGuardRecord(data)
      } else {
        setGuardRecord({
          name: name.trim(),
          service_number: serviceNumber.trim().toUpperCase(),
          rank: rank.trim()
        })
      }
      setStep(2)
    } catch {
      setGuardRecord({
        name: name.trim(),
        service_number: serviceNumber.trim().toUpperCase(),
        rank: rank.trim()
      })
      setStep(2)
    } finally { setLoading(false) }
  }

  async function beginShift() {
    setLoading(true)
    const guardObj = {
      name: guardRecord.name,
      serviceNumber: guardRecord.service_number,
      rank: guardRecord.rank || rank || '',
    }
    try {
      const { data: shiftLog } = await supabase
        .from('shift_logs')
        .insert({
          tenant_id: tenantData.id,
          gate_id: gateData.id,
          officer_name: guardRecord.name,
          service_number: guardRecord.service_number,
          shift_start: new Date().toISOString()
        })
        .select()
        .single()

      startShift(guardObj, gateData, tenantData, shiftLog?.id || null)
    } catch {
      startShift(guardObj, gateData, tenantData, null)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {tenantData?.logo_url
            ? <img src={tenantData.logo_url} alt="logo" style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', margin: '0 auto 12px', display: 'block' }} />
            : <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
          }
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '2px' }}>
            {tenantData?.name || 'SENTRi'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{gateData?.name}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SENTRi Gate Intelligence
          </p>
        </div>

        <div className="steps">
          {[1, 2].map(s => <div key={s} className={\`step-bar \${step >= s ? 'active' : ''}\`} />)}
        </div>

        {/* Step 1 — Identity */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              Confirm your identity
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              All entries this shift will be logged under your name.
            </p>

            <div className="field">
              <label>{config.idLabel}</label>
              <input type="text" placeholder={config.idPlaceholder} value={serviceNumber}
                onChange={e => setServiceNumber(e.target.value.toUpperCase())}
                style={{ fontFamily: config.idMono ? 'var(--font-mono)' : 'inherit', letterSpacing: config.idMono ? '0.06em' : 0, fontSize: '16px' }} />
            </div>

            {config.showRank && (
              <div className="field">
                <label>{config.rankLabel}</label>
                <input type="text" placeholder={config.rankPlaceholder} value={rank}
                  onChange={e => setRank(e.target.value)} autoCapitalize="words" />
              </div>
            )}

            <div className="field" style={{ marginBottom: '20px' }}>
              <label>{config.nameLabel}</label>
              <input type="text" placeholder="Your full name" value={name}
                onChange={e => setName(e.target.value)} autoCapitalize="words" />
            </div>

            {error && <div className="alert alert-warn" style={{ marginBottom: '16px' }}>{error}</div>}

            <button className="btn btn-primary btn-full btn-lg" onClick={verifyIdentity}
              disabled={loading || !serviceNumber.trim() || !name.trim()}>
              {loading
                ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Verifying...</>
                : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && guardRecord && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
              Ready to start shift?
            </h2>
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
              {[
                { label: 'Officer', value: config.displayTitle(guardRecord) },
                { label: config.idLabel, value: guardRecord.service_number, mono: true },
                { label: 'Gate', value: gateData?.name },
                { label: 'Installation', value: tenantData?.name },
                { label: 'Shift start', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-display)', color: 'var(--text-0)' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '14px 20px' }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={beginShift} disabled={loading}>
                {loading ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : '✓ Begin shift'}
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '16px' }}>
          SENTRi by IGATA Technologies · All movement is recorded
        </p>
      </div>
    </div>
  )
}
`

fs.writeFileSync(shiftStartPath, shiftStartContent, 'utf8')
console.log('✓ ShiftStart.jsx rewritten with sector-aware identity fields')

// ─────────────────────────────────────────────────────────────
// 3. Add registration notification email to CommandLogin.jsx
// ─────────────────────────────────────────────────────────────
const loginPath = path.join(process.cwd(), 'src', 'pages', 'auth', 'CommandLogin.jsx')
let loginContent = fs.readFileSync(loginPath, 'utf8').replace(/^\uFEFF/, '')

// Add sector field to register form state
if (!loginContent.includes("const [sector, setSector] = useState")) {
  loginContent = loginContent.replace(
    `const [installationName, setInstallationName] = useState('')`,
    `const [installationName, setInstallationName] = useState('')
  const [sector, setSector] = useState('military')`
  )
}

// Add notification email after successful registration (after setRegSuccess(true))
const notifEmail = `
    // Notify Mannie of new registration
    try {
      await fetch('/.netlify/functions/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ['igataprojects@gmail.com'],
          subject: 'New SENTRi Registration — ' + installationName.trim(),
          html: \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:28px;">
                <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">SENTRi</div>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">New Registration Alert</div>
              </div>
              <div style="padding:28px;">
                <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a2e;">New account registered</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;width:40%;">Installation</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">\${installationName.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Officer name</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">\${rank.trim() ? rank.trim() + ' ' : ''}\${name.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">\${email.trim()}</td></tr>
                  <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;">Registered</td><td style="padding:8px 0;font-size:14px;">\${new Date().toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                </table>
                <a href="https://sentri-igata.netlify.app/admin" style="display:block;margin-top:24px;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Review in Superadmin →</a>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #e2e6ed;font-size:11px;color:#9ca3af;">IGATA Technologies · SENTRi Platform</div>
            </div>
          </body></html>\`
        })
      })
    } catch (e) { console.error('Notification email error:', e) }`

loginContent = loginContent.replace(
  `setRegLoading(false)
    setRegSuccess(true)`,
  `setRegLoading(false)
    setRegSuccess(true)
    ${notifEmail}`
)

fs.writeFileSync(loginPath, loginContent, 'utf8')
console.log('✓ Registration notification email added to CommandLogin.jsx')

// ─────────────────────────────────────────────────────────────
// 4. PWA manifest split — Gate vs Command
// ─────────────────────────────────────────────────────────────

// Create public/manifest-gate.json
const manifestGateDir = path.join(process.cwd(), 'public')
if (!fs.existsSync(manifestGateDir)) fs.mkdirSync(manifestGateDir, { recursive: true })

const manifestGate = {
  name: 'SENTRi Gate',
  short_name: 'SENTRi Gate',
  description: 'Gate access control for secure facilities — by IGATA Technologies',
  theme_color: '#0a0f1e',
  background_color: '#0a0f1e',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/gate/',
  start_url: '/gate/',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}

const manifestCommand = {
  name: 'SENTRi Command',
  short_name: 'SENTRi',
  description: 'Movement intelligence command dashboard — by IGATA Technologies',
  theme_color: '#1a56db',
  background_color: '#f0f2f5',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/',
  start_url: '/command',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}

fs.writeFileSync(path.join(manifestGateDir, 'manifest-gate.json'), JSON.stringify(manifestGate, null, 2), 'utf8')
fs.writeFileSync(path.join(manifestGateDir, 'manifest-command.json'), JSON.stringify(manifestCommand, null, 2), 'utf8')
console.log('✓ manifest-gate.json and manifest-command.json created in public/')

// Update vite.config.js — command manifest stays as default
const vitePath = path.join(process.cwd(), 'vite.config.js')
let viteContent = fs.readFileSync(vitePath, 'utf8').replace(/^\uFEFF/, '')

viteContent = viteContent.replace(
  `manifest: {
        name: 'SENTRi Gate Intelligence',
        short_name: 'SENTRi',
        description: 'Movement intelligence for secure facilities ├óÔé¼ÔÇØ by IGATA Technologies',
        theme_color: '#1a56db',
        background_color: '#f0f2f5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },`,
  `manifest: {
        name: 'SENTRi Command',
        short_name: 'SENTRi',
        description: 'Movement intelligence command dashboard — by IGATA Technologies',
        theme_color: '#1a56db',
        background_color: '#f0f2f5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/command',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },`
)

fs.writeFileSync(vitePath, viteContent, 'utf8')
console.log('✓ vite.config.js updated — Command PWA manifest')

// Create/update _headers for Netlify to serve gate manifest on gate routes
const headersPath = path.join(process.cwd(), 'public', '_headers')
const headersContent = `/gate/*
  Link: </manifest-gate.json>; rel="manifest"

/command/*
  Link: </manifest-command.json>; rel="manifest"

/login
  Link: </manifest-command.json>; rel="manifest"
`
fs.writeFileSync(headersPath, headersContent, 'utf8')
console.log('✓ public/_headers created — Netlify serves correct manifest per route')

// Update GateApp to link gate manifest in head
const gateAppPath = path.join(process.cwd(), 'src', 'pages', 'gate', 'GateApp.jsx')
let gateAppContent = fs.readFileSync(gateAppPath, 'utf8').replace(/^\uFEFF/, '')

if (!gateAppContent.includes('manifest-gate')) {
  // Add useEffect to swap manifest link tag on gate pages
  if (!gateAppContent.includes("import { useState, useEffect }")) {
    gateAppContent = gateAppContent.replace(
      `import { useState`,
      `import { useState, useEffect`
    )
  }
  // Add manifest swap after first useState in GateApp component
  gateAppContent = gateAppContent.replace(
    `export default function GateApp`,
    `// Swap manifest for gate PWA
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

export default function GateApp`
  )

  // Call the hook inside GateApp
  gateAppContent = gateAppContent.replace(
    `const { onShift, activeTab`,
    `useGateManifest()
  const { onShift, activeTab`
  )

  fs.writeFileSync(gateAppPath, gateAppContent, 'utf8')
  console.log('✓ GateApp.jsx updated — swaps to gate manifest on load')
} else {
  console.log('✓ GateApp.jsx already has manifest swap')
}

// ─────────────────────────────────────────────────────────────
// Git push
// ─────────────────────────────────────────────────────────────
try {
  execSync('git add src/store/index.js src/pages/gate/ShiftStart.jsx src/pages/auth/CommandLogin.jsx src/pages/gate/GateApp.jsx vite.config.js public/manifest-gate.json public/manifest-command.json public/_headers', { stdio: 'inherit' })
  execSync('git commit -m "Fix: officer name, sector-aware ShiftStart, reg notification email, PWA manifest split"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nAll four fixes deployed in one push.')
console.log('- Officer name now passes correctly through store')
console.log('- ShiftStart reads tenant sector and adapts field labels')
console.log('- New registration fires email to igataprojects@gmail.com')
console.log('- Gate PWA installs as "SENTRi Gate" (dark), Command as "SENTRi Command" (blue)')
