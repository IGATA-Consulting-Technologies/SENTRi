// SENTRi — Complete Fix: Incidents + Registration + Watchlist
// Run with: node --input-type=commonjs < full_fix.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. REPORT INCIDENT PAGE (clean UI + reliable submit) ─────────────────────

const reportIncidentPage = `import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

const INCIDENT_TYPES = [
  { value: 'unauthorized_access', label: 'Unauthorized Access Attempt' },
  { value: 'suspicious_vehicle', label: 'Suspicious Vehicle' },
  { value: 'suspicious_person', label: 'Suspicious Person' },
  { value: 'altercation', label: 'Altercation' },
  { value: 'medical_emergency', label: 'Medical Emergency' },
  { value: 'equipment_issue', label: 'Equipment Issue' },
  { value: 'perimeter_breach', label: 'Perimeter Breach' },
  { value: 'contraband_detected', label: 'Contraband Detected' },
  { value: 'other', label: 'Other' },
]

const SEVERITIES = [
  { value: 'routine', label: 'Routine', desc: 'Minor — for record only', color: 'var(--accent)', bg: 'rgba(26,86,219,0.08)' },
  { value: 'serious', label: 'Serious', desc: 'Requires command attention', color: 'var(--amber)', bg: 'rgba(146,83,10,0.08)' },
  { value: 'critical', label: 'CRITICAL', desc: 'Immediate response needed', color: 'var(--red)', bg: 'rgba(192,19,42,0.08)' },
]

export default function ReportIncidentPage({ onBack }) {
  const { guard, gate, tenant } = useGuardStore()
  const [incidentType, setIncidentType] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submitIncident() {
    setError('')
    if (!incidentType) { setError('Please select an incident type'); return }
    if (!severity) { setError('Please select a severity level'); return }
    if (!description.trim()) { setError('Please describe what happened'); return }

    setSubmitting(true)

    // Look up officer — but don't block submit if not found
    let officerId = null
    try {
      const { data: officerData } = await supabase
        .from('officers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('service_number', guard?.serviceNumber)
        .single()
      officerId = officerData?.id || null
    } catch (e) {
      // Officer lookup failed — proceed without officer_id
    }

    const { error: err } = await supabase.from('incidents').insert({
      tenant_id: tenant.id,
      gate_id: gate?.id || null,
      officer_id: officerId,
      type: incidentType,
      severity,
      description: description.trim(),
      location: location.trim() || null,
      status: 'open'
    })

    setSubmitting(false)

    if (err) {
      console.error('Incident submit error:', err)
      setError('Failed to submit: ' + err.message)
      return
    }

    setSubmitted(true)
  }

  // Success screen
  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div className="pop" style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: severity === 'critical' ? 'var(--red)' : severity === 'serious' ? 'var(--amber)' : 'var(--green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
        Incident Reported
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>
        Report submitted successfully.
      </p>
      {severity === 'critical' && (
        <div style={{ background: 'rgba(192,19,42,0.1)', border: '1.5px solid rgba(192,19,42,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 20px', marginBottom: '20px', color: 'var(--red)', fontWeight: '700', fontSize: '13px' }}>
          CRITICAL — Command has been alerted.
        </div>
      )}
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '320px' }} onClick={onBack}>
        Back to gate
      </button>
    </div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px', padding: 0 }}>
          ← Back
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', margin: 0 }}>Report Incident</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{gate?.name}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Incident Type — dropdown */}
      <div className="field">
        <label>Incident type *</label>
        <select value={incidentType} onChange={e => setIncidentType(e.target.value)}>
          <option value="">Select incident type...</option>
          {INCIDENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Severity — clean card selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
          Severity *
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SEVERITIES.map(s => (
            <button key={s.value} onClick={() => setSeverity(s.value)}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '2px solid',
                borderColor: severity === s.value ? s.color : 'var(--border-med)',
                background: severity === s.value ? s.bg : 'var(--bg-1)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50', flexShrink: 0,
                background: severity === s.value ? s.color : 'var(--border-med)',
                borderRadius: '50%'
              }} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: s.color }}>{s.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="field">
        <label>Description *</label>
        <textarea
          placeholder="Describe exactly what happened, who was involved, and any actions taken..."
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', background: 'var(--bg-1)', color: 'var(--text-0)', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Location */}
      <div className="field">
        <label>Specific location (optional)</label>
        <input type="text" placeholder="e.g. Gate entrance, North fence, Checkpoint B"
          value={location} onChange={e => setLocation(e.target.value)} />
      </div>

      {/* Submit */}
      <button
        className={'btn btn-full btn-lg ' + (severity === 'critical' ? 'btn-danger' : 'btn-primary')}
        onClick={submitIncident}
        disabled={submitting || !incidentType || !severity || !description.trim()}
        style={{ marginTop: '8px' }}
      >
        {submitting
          ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Submitting...</>
          : severity === 'critical'
            ? '🚨 Submit CRITICAL Incident'
            : 'Submit incident report'
        }
      </button>
    </div>
  )
}
`

// ─── 2. COMMAND LOGIN WITH REGISTRATION ──────────────────────────────────────

const commandLogin = `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'

export default function CommandLogin() {
  const { login, authLoading, authError } = useAuthStore()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [rank, setRank] = useState('')
  const [serviceNumber, setServiceNumber] = useState('')
  const [installationName, setInstallationName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    const result = await login(email.trim(), password)
    if (result?.success) {
      navigate(result.role === 'admin' ? '/admin' : '/command')
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegError('')
    if (!name.trim()) { setRegError('Full name is required'); return }
    if (!email.trim()) { setRegError('Email is required'); return }
    if (!password) { setRegError('Password is required'); return }
    if (password.length < 8) { setRegError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setRegError('Passwords do not match'); return }
    if (!installationName.trim()) { setRegError('Installation name is required'); return }

    setRegLoading(true)

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password
    })

    if (authErr) {
      setRegError(authErr.message)
      setRegLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setRegError('Registration failed. Please try again.')
      setRegLoading(false)
      return
    }

    // Create a pending tenant for this installation
    const tenantSlug = installationName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: installationName.trim(),
        slug: tenantSlug + '-' + userId.slice(0, 6),
        sector: 'military',
        is_active: true
      })
      .select()
      .single()

    if (tenantErr) {
      setRegError('Could not create installation: ' + tenantErr.message)
      setRegLoading(false)
      return
    }

    // Create officer record linked to tenant
    const { error: officerErr } = await supabase
      .from('officers')
      .insert({
        id: userId,
        name: name.trim(),
        rank: rank.trim() || 'Officer',
        email: email.trim().toLowerCase(),
        service_number: serviceNumber.trim() || null,
        tenant_id: tenantData.id,
        role: 'command',
        is_active: true
      })

    if (officerErr) {
      setRegError('Could not create officer profile: ' + officerErr.message)
      setRegLoading(false)
      return
    }

    setRegLoading(false)
    setRegSuccess(true)
  }

  const eyeIcon = (
    <button type="button" onClick={() => setShowPass(s => !s)} style={{
      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)',
      display: 'flex', alignItems: 'center', padding: '4px'
    }}>
      {showPass
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }} className="fade-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px', height: '60px', background: 'var(--accent)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>SENTRi</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
            {mode === 'login' ? 'Command Dashboard' : 'Create Account'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>by IGATA Technologies</p>
        </div>

        {/* Toggle tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '20px' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setRegError(''); setRegSuccess(false) }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 'calc(var(--radius-md) - 2px)',
                background: mode === m ? 'var(--bg-1)' : 'transparent',
                color: mode === m ? 'var(--text-0)' : 'var(--text-2)',
                fontFamily: 'var(--font-display)', fontWeight: mode === m ? '700' : '500',
                fontSize: '13px', cursor: 'pointer',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s'
              }}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" style={{ paddingRight: '44px' }} />
                  {eyeIcon}
                </div>
              </div>
              {authError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {authError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full btn-lg"
                disabled={authLoading || !email || !password}>
                {authLoading
                  ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Signing in...</>
                  : 'Sign in to command'}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && !regSuccess && (
            <form onSubmit={handleRegister}>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', background: 'var(--bg-2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                Create your SENTRi command account. Your installation will be set up automatically.
              </div>
              <div className="field-row" style={{ marginBottom: '10px' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Full name *</label>
                  <input type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} autoCapitalize="words" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Rank / Title</label>
                  <input type="text" placeholder="e.g. Colonel" value={rank} onChange={e => setRank(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Service / Staff number</label>
                <input type="text" placeholder="Optional" value={serviceNumber}
                  onChange={e => setServiceNumber(e.target.value.toUpperCase())}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
              </div>
              <div className="field">
                <label>Installation name *</label>
                <input type="text" placeholder="e.g. Ikeja Cantonment" value={installationName}
                  onChange={e => setInstallationName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email address *</label>
                <input type="email" placeholder="your@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: '44px' }} />
                  {eyeIcon}
                </div>
              </div>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Confirm password *</label>
                <input type="password" placeholder="Repeat password"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              {regError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {regError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={regLoading}>
                {regLoading
                  ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Creating account...</>
                  : 'Create account'}
              </button>
            </form>
          )}

          {/* REGISTER SUCCESS */}
          {mode === 'register' && regSuccess && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Account created!</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
                Your SENTRi command account is ready. Sign in to get started.
              </p>
              <button className="btn btn-primary btn-full" onClick={() => { setMode('login'); setRegSuccess(false) }}>
                Sign in now
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '16px' }}>
          Authorised personnel only · All access is logged and audited
        </p>
      </div>
    </div>
  )
}
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing files...')

fs.writeFileSync('src/pages/gate/ReportIncidentPage.jsx', reportIncidentPage, 'utf8')
console.log('✓ ReportIncidentPage.jsx — dropdown UI + reliable submit')

fs.writeFileSync('src/pages/auth/CommandLogin.jsx', commandLogin, 'utf8')
console.log('✓ CommandLogin.jsx — sign in + create account tabs')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const incident = fs.readFileSync('src/pages/gate/ReportIncidentPage.jsx', 'utf8')
const login = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')

const checks = {
  'Incident: dropdown not grid': incident.includes('<select') && !incident.includes('type-grid'),
  'Incident: no blocking officer lookup': incident.includes('catch (e)'),
  'Incident: clean error display': incident.includes('alert-danger'),
  'Incident: success screen': incident.includes('Incident Reported'),
  'Login: register tab exists': login.includes("setMode('register')"),
  'Login: supabase.auth.signUp': login.includes('signUp'),
  'Login: creates tenant': login.includes("from('tenants')"),
  'Login: creates officer': login.includes("from('officers')"),
  'Login: password validation': login.includes('password.length < 8'),
  'Login: success screen': login.includes('Account created'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) {
  console.log('\nSome checks failed — not pushing')
  process.exit(1)
}

// ─── GIT PUSH ─────────────────────────────────────────────────────────────────

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Fix incidents UI + submit, add self-registration to command login"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nAlso run this SQL in Supabase:')
console.log('(See instructions below)')
