// SENTRi — Complete Fix Script
// Fixes: RLS blocking inserts, offline sync, plate recognizer proxy
// Run with: node --input-type=commonjs < sentri_fix.js

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ─── 1. NETLIFY PROXY FUNCTION (zero npm dependencies) ───────────────────────

const plateRecognizerFn = `const https = require('https')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { image } = JSON.parse(event.body)
    if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) }

    const imageBuffer = Buffer.from(image, 'base64')
    const boundary = 'SENTRiBoundary' + Date.now()

    // Build multipart form manually — no npm needed
    const regionPart = [
      '--' + boundary,
      'Content-Disposition: form-data; name="regions"',
      '',
      'ng'
    ].join('\\r\\n')

    const filePart = [
      '\\r\\n--' + boundary,
      'Content-Disposition: form-data; name="upload"; filename="plate.jpg"',
      'Content-Type: image/jpeg',
      ''
    ].join('\\r\\n')

    const closing = '\\r\\n--' + boundary + '--\\r\\n'

    const body = Buffer.concat([
      Buffer.from(regionPart + '\\r\\n'),
      Buffer.from(filePart + '\\r\\n'),
      imageBuffer,
      Buffer.from(closing)
    ])

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.platerecognizer.com',
        path: '/v1/plate-reader/',
        method: 'POST',
        headers: {
          'Authorization': 'Token cd023a0e31de97d28995b3849851088c23403542',
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': body.length
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(new Error('Invalid JSON from PlateRecognizer: ' + data)) }
        })
      })

      req.on('error', reject)
      req.write(body)
      req.end()
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }

  } catch (error) {
    console.error('Proxy error:', error.message)
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message, results: [] })
    }
  }
}
`

// ─── 2. GATEAPP — with offline sync engine ───────────────────────────────────

const gateAppContent = `import { useEffect, useState } from 'react'
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
    console.log('Syncing', unsynced.length, 'offline entries...')
    for (const item of unsynced) {
      const movement = item.data || item
      const { localId, synced, queuedAt, action, ...cleanMovement } = movement
      const { error } = await supabase.from('movements').insert(cleanMovement)
      if (!error) {
        await markSynced(item.localId)
        console.log('Synced entry:', cleanMovement.plate_number || cleanMovement.visitor_name)
      } else {
        console.error('Sync failed for entry:', error.message)
      }
    }
  } catch (e) {
    console.error('Sync engine error:', e)
  }
}

export default function GateApp() {
  const { tenantSlug, gateSlug } = useParams()
  const { onShift, gate, tenant, activeTab, setActiveTab } = useGuardStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadGate() }, [tenantSlug, gateSlug])

  // Sync offline queue on load and when coming back online
  useEffect(() => {
    if (navigator.onLine) syncOfflineQueue()
    const handleOnline = () => {
      console.log('Back online — syncing queue...')
      syncOfflineQueue()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  async function loadGate() {
    setLoading(true)
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants').select('*').eq('slug', tenantSlug).eq('is_active', true).single()
    if (tenantErr || !tenantData) { setError('Installation not found or inactive.'); setLoading(false); return }
    const { data: gateData, error: gateErr } = await supabase
      .from('gates').select('*').eq('tenant_id', tenantData.id).eq('slug', gateSlug).eq('is_active', true).single()
    if (gateErr || !gateData) { setError('Gate not found or inactive.'); setLoading(false); return }
    useGuardStore.getState().setTenant(tenantData)
    useGuardStore.getState().setGate(gateData)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-0)', gap: '12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', letterSpacing: '0.12em', color: 'var(--accent)' }}>SENTRi</div>
      <div className="spinner" style={{ width: '20px', height: '20px' }} />
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Access Denied</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>{error}</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-0)', overflow: 'hidden' }}>
      <header style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '13px', letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase' }}>SENTRi</div>
        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-0)', marginTop: '1px' }}>{gate?.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{tenant?.name}</div>
      </header>
      <main style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</main>
      <nav style={{ display: 'flex', background: 'var(--bg-1)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px 8px', border: 'none', cursor: 'pointer', gap: '3px', fontSize: '10px',
              fontFamily: 'var(--font-display)', fontWeight: '600', letterSpacing: '0.03em', transition: 'all 0.15s',
              background: activeTab === tab.key ? 'var(--accent-dim)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : tab.key === 'incident' ? 'var(--red)' : 'var(--text-2)',
              borderTop: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent'
            }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing fixes...')

// Fix 1: Netlify proxy function
fs.mkdirSync('netlify/functions', { recursive: true })
fs.writeFileSync('netlify/functions/plate-recognizer.js', plateRecognizerFn, 'utf8')
console.log('✓ netlify/functions/plate-recognizer.js — rewritten, zero npm deps')

// Fix 2: GateApp with sync engine
fs.writeFileSync('src/pages/gate/GateApp.jsx', gateAppContent, 'utf8')
console.log('✓ src/pages/gate/GateApp.jsx — offline sync engine added')

// Fix 3: Remove the functions package.json (was requiring node-fetch/form-data)
const fnPkgPath = 'netlify/functions/package.json'
if (fs.existsSync(fnPkgPath)) {
  fs.unlinkSync(fnPkgPath)
  console.log('✓ netlify/functions/package.json — removed (no longer needed)')
}

// ─── GIT PUSH ─────────────────────────────────────────────────────────────────

console.log('\nPushing to GitHub...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Fix: plate recognizer proxy (no npm deps) + offline sync engine"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nNEXT STEP: Run the SQL fix in Supabase (see instructions above).')
