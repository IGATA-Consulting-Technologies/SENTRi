// SENTRi — Complete Onboarding Build
// Delivers: forgot password, password reset page, onboarding wizard, dynamic destinations
// Run with: node --input-type=commonjs < onboarding_build.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. UPDATED CommandLogin — adds forgot password link ─────────────────────

const commandLogin = `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'

export default function CommandLogin() {
  const { login, authLoading, authError } = useAuthStore()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
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
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    const result = await login(email.trim(), password)
    if (result?.success) {
      navigate(result.role === 'admin' ? '/admin' : '/command')
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email.trim()) { setRegError('Please enter your email address'); return }
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + '/reset-password'
    })
    setForgotLoading(false)
    if (error) { setRegError(error.message); return }
    setForgotSent(true)
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

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: window.location.origin + '/login' }
    })

    if (authErr) { setRegError(authErr.message); setRegLoading(false); return }

    const userId = authData.user?.id
    if (!userId) { setRegError('Registration failed. Please try again.'); setRegLoading(false); return }

    const tenantSlug = installationName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '') + '-' + userId.slice(0, 6)

    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: installationName.trim(),
        slug: tenantSlug,
        sector: 'military',
        is_active: true,
        custom_destinations: [],
        custom_purposes: []
      })
      .select().single()

    if (tenantErr) { setRegError('Could not create installation: ' + tenantErr.message); setRegLoading(false); return }

    const { error: officerErr } = await supabase.from('officers').insert({
      id: userId,
      name: name.trim(),
      rank: rank.trim() || 'Officer',
      email: email.trim().toLowerCase(),
      service_number: serviceNumber.trim() || null,
      tenant_id: tenantData.id,
      role: 'command',
      is_active: true
    })

    if (officerErr) { setRegError('Could not create officer profile: ' + officerErr.message); setRegLoading(false); return }

    setRegLoading(false)
    setRegSuccess(true)
  }

  const switchMode = (m) => { setMode(m); setRegError(''); setRegSuccess(false); setForgotSent(false) }

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }} className="fade-up">

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>SENTRi</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
            {mode === 'login' ? 'Command Dashboard' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>by IGATA Technologies</p>
        </div>

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '20px' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 'calc(var(--radius-md) - 2px)',
                background: mode === m ? 'var(--bg-1)' : 'transparent',
                color: mode === m ? 'var(--text-0)' : 'var(--text-2)',
                fontFamily: 'var(--font-display)', fontWeight: mode === m ? '700' : '500',
                fontSize: '13px', cursor: 'pointer',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s'
              }}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field" style={{ marginBottom: '8px' }}>
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" style={{ paddingRight: '44px' }} />
                  {eyeIcon}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Forgot password?
                </button>
              </div>
              {authError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {authError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={authLoading || !email || !password}>
                {authLoading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Signing in...</> : 'Sign in to command'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && !forgotSent && (
            <form onSubmit={handleForgotPassword}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                Enter your registered email and we will send you a password reset link.
              </p>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Email address</label>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => { setEmail(e.target.value); setRegError('') }} autoComplete="email" />
              </div>
              {regError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{regError}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={forgotLoading || !email}>
                {forgotLoading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Sending...</> : 'Send reset link'}
              </button>
              <button type="button" onClick={() => switchMode('login')} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Back to sign in
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotSent && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📧</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Check your email</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
                We sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <button className="btn btn-ghost btn-full" onClick={() => switchMode('login')}>Back to sign in</button>
            </div>
          )}

          {/* REGISTER */}
          {mode === 'register' && !regSuccess && (
            <form onSubmit={handleRegister}>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', background: 'var(--bg-2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                Create your SENTRi command account. You will complete setup after signing in.
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
                <label>Installation name *</label>
                <input type="text" placeholder="e.g. Ikeja Cantonment" value={installationName} onChange={e => setInstallationName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email address *</label>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: '44px' }} />
                  {eyeIcon}
                </div>
              </div>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Confirm password *</label>
                <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              {regError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{regError}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={regLoading}>
                {regLoading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Creating account...</> : 'Create account'}
              </button>
            </form>
          )}

          {mode === 'register' && regSuccess && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Account created!</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
                Sign in to complete your installation setup.
              </p>
              <button className="btn btn-primary btn-full" onClick={() => switchMode('login')}>Sign in now</button>
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

// ─── 2. PASSWORD RESET PAGE ───────────────────────────────────────────────────

const resetPasswordPage = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true)
    })
    // Also listen for the auth event from the email link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setValidSession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>SENTRi</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reset Password</p>
        </div>

        <div className="card" style={{ padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Password updated!</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Redirecting to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Enter your new password below.</p>
              <div className="field">
                <label>New password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: '44px' }} />
                  <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Confirm new password</label>
                <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || !password || !confirmPassword}>
                {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Updating...</> : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
`

// ─── 3. ONBOARDING WIZARD ─────────────────────────────────────────────────────

const onboardingWizard = `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const DEFAULT_DESTINATIONS = {
  military: ['Administration Block', 'Officers Mess', 'Barracks / Quarters', 'Armoury', 'Medical Centre', 'Sports Complex', 'Provost Office', 'Signals Unit', 'Quartermaster Store', 'Commanding Officer Office'],
  oil_gas: ['Control Room', 'Wellhead Area', 'Refinery Block', 'Admin Building', 'Warehouse', 'Maintenance Bay', 'HSE Office', 'Canteen', 'Medical Bay', 'Security Post'],
  bank: ['Banking Hall', 'Vault Area', 'Executive Floor', 'IT Room', 'HR Office', 'Board Room', 'Customer Service', 'Back Office', 'ATM Room', 'Security Room'],
  corporate: ['Reception', 'Executive Suite', 'Conference Room', 'IT Department', 'Finance', 'HR Department', 'Operations', 'Warehouse', 'Cafeteria', 'Server Room'],
  other: ['Main Office', 'Reception', 'Meeting Room', 'Warehouse', 'Security Post', 'Management Office', 'Staff Area', 'Visitor Lounge']
}

const DEFAULT_PURPOSES = {
  military: ['Official visit', 'Delivery / Supply', 'Maintenance / Repair', 'Training', 'Personal visit', 'Medical', 'Contractor / Vendor'],
  oil_gas: ['Official visit', 'Contractor / Vendor', 'HSE Inspection', 'Maintenance', 'Delivery', 'Emergency Response', 'Audit', 'Training'],
  bank: ['Official visit', 'Audit', 'IT Support', 'Delivery', 'Meeting', 'Contractor', 'Regulatory Visit', 'Training'],
  corporate: ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Interview', 'Training', 'Client Visit'],
  other: ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Personal visit', 'Training']
}

const SECTORS = [
  { value: 'military', label: 'Military / Defence', icon: '🛡️' },
  { value: 'oil_gas', label: 'Oil & Gas', icon: '⚙️' },
  { value: 'bank', label: 'Banking / Finance', icon: '🏦' },
  { value: 'corporate', label: 'Corporate', icon: '🏢' },
  { value: 'other', label: 'Other', icon: '🏛️' },
]

export default function OnboardingWizard() {
  const { tenant, officer } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Installation details
  const [sector, setSector] = useState(tenant?.sector || 'military')
  const [branch, setBranch] = useState(tenant?.branch || '')
  const [city, setCity] = useState(tenant?.city || '')
  const [state, setState] = useState(tenant?.state || '')

  // Step 2 — Gates
  const [gates, setGates] = useState([{ name: '', location: '' }])

  // Step 3 — Destinations
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS['military'])
  const [newDest, setNewDest] = useState('')

  // Step 4 — Purposes
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES['military'])
  const [newPurpose, setNewPurpose] = useState('')

  function handleSectorChange(s) {
    setSector(s)
    setDestinations(DEFAULT_DESTINATIONS[s] || DEFAULT_DESTINATIONS.other)
    setPurposes(DEFAULT_PURPOSES[s] || DEFAULT_PURPOSES.other)
  }

  async function saveStep1() {
    if (!sector) { setError('Please select your sector'); return }
    setSaving(true)
    await supabase.from('tenants').update({ sector, branch: branch.trim(), city: city.trim(), state: state.trim() }).eq('id', tenant.id)
    setSaving(false); setStep(2)
  }

  async function saveStep2() {
    const validGates = gates.filter(g => g.name.trim())
    if (validGates.length === 0) { setError('Add at least one gate'); return }
    setSaving(true)
    for (const g of validGates) {
      const slug = g.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
      await supabase.from('gates').insert({
        tenant_id: tenant.id,
        name: g.name.trim(),
        slug: slug + '-' + Math.random().toString(36).slice(2, 6),
        location: g.location.trim() || null,
        is_active: true
      })
    }
    setSaving(false); setStep(3)
  }

  async function saveStep3() {
    if (destinations.length === 0) { setError('Add at least one destination'); return }
    setSaving(true)
    await supabase.from('tenants').update({ custom_destinations: destinations }).eq('id', tenant.id)
    setSaving(false); setStep(4)
  }

  async function saveStep4() {
    if (purposes.length === 0) { setError('Add at least one purpose'); return }
    setSaving(true)
    await supabase.from('tenants').update({ custom_purposes: purposes, onboarding_complete: true }).eq('id', tenant.id)
    setSaving(false); setStep(5)
  }

  const progress = (step / 5) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '52px', height: '52px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(26,86,219,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Welcome to SENTRi</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
        </div>

        {/* Progress */}
        {step < 5 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              {['Details', 'Gates', 'Destinations', 'Purposes'].map((label, i) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-3)', color: step >= i + 1 ? 'white' : 'var(--text-2)' }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '10px', color: step === i + 1 ? 'var(--accent)' : 'var(--text-2)', fontWeight: step === i + 1 ? '600' : '400' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: progress + '%', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* STEP 1 — Installation Details */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Installation details</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Tell us about your facility so SENTRi is configured correctly.</p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Sector *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {SECTORS.map(s => (
                  <button key={s.value} onClick={() => { handleSectorChange(s.value); setError('') }}
                    style={{ padding: '12px', border: '2px solid', borderColor: sector === s.value ? 'var(--accent)' : 'var(--border-med)', borderRadius: 'var(--radius-md)', background: sector === s.value ? 'rgba(26,86,219,0.06)' : 'var(--bg-1)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{s.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: sector === s.value ? '700' : '500', color: sector === s.value ? 'var(--accent)' : 'var(--text-0)' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-row" style={{ marginBottom: '10px' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Branch / Division</label>
                <input type="text" placeholder="e.g. Army, Navy" value={branch} onChange={e => setBranch(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>City</label>
                <input type="text" placeholder="e.g. Lagos" value={city} onChange={e => setCity(e.target.value)} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: '24px' }}>
              <label>State</label>
              <input type="text" placeholder="e.g. Lagos State" value={state} onChange={e => setState(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={saveStep1} disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</> : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 2 — Gates */}
        {step === 2 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your gates</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Add every gate or entry point at your facility. Each gets its own guard PWA URL.</p>

            {gates.map((gate, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate {i + 1}</span>
                  {gates.length > 1 && <button onClick={() => setGates(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                </div>
                <div className="field-row">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Gate name *</label>
                    <input type="text" placeholder="e.g. Main Gate" value={gate.name} onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Location (optional)</label>
                    <input type="text" placeholder="e.g. North entrance" value={gate.location} onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, location: e.target.value } : g))} />
                  </div>
                </div>
              </div>
            ))}

            <button className="btn btn-outline btn-full" style={{ marginBottom: '20px' }} onClick={() => setGates(prev => [...prev, { name: '', location: '' }])}>
              + Add another gate
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep2() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Destinations */}
        {step === 3 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Destinations</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              These are the locations inside your facility that visitors go to. Guards select from this list when admitting entries.
              We've pre-filled common ones for your sector — edit freely.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-0)' }}>{dest}</span>
                  <button onClick={() => setDestinations(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a destination..." value={newDest} onChange={e => setNewDest(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}>Add</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep3() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Purposes */}
        {step === 4 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Visit purposes</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Why do visitors come to your facility? Guards select the purpose when admitting entries.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {purposes.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-0)' }}>{p}</span>
                  <button onClick={() => setPurposes(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a visit purpose..." value={newPurpose} onChange={e => setNewPurpose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}>Add</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep4() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Complete */}
        {step === 5 && (
          <div className="card fade-up" style={{ padding: '32px', textAlign: 'center' }}>
            <div className="pop" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 24px rgba(14,124,58,0.25)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Setup complete!</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>
              Your installation is ready. Go to the Gates tab to get your guard PWA URLs and send them to your officers.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '28px' }}>
              Welcome to SENTRi.
            </p>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/command')}>
              Go to command dashboard →
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '20px' }}>
          Powered by IGATA Technologies
        </p>
      </div>
    </div>
  )
}
`

// ─── 4. UPDATE App.jsx — add reset-password and onboarding routes ─────────────

const appContent = `import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuthStore, useGuardStore } from './store'
import GateApp from './pages/gate/GateApp'
import CommandApp from './pages/command/CommandApp'
import AdminApp from './pages/admin/AdminApp'
import CommandLogin from './pages/auth/CommandLogin'
import ResetPassword from './pages/auth/ResetPassword'
import OnboardingWizard from './pages/auth/OnboardingWizard'
import NotFound from './pages/NotFound'

function GateRoute() {
  const { tenantSlug, gateSlug } = useParams()
  return <GateApp tenantSlug={tenantSlug} gateSlug={gateSlug} />
}

function CommandRoute() {
  const { isAuthenticated, officer } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (officer?.role === 'admin') return <Navigate to="/admin" replace />
  return <CommandApp />
}

function OnboardingRoute() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <OnboardingWizard />
}

function AdminRoute() {
  return <AdminApp />
}

export default function App() {
  const { setOnline, restoreSession } = useAuthStore()
  const { setOnline: guardSetOnline } = useGuardStore()

  useEffect(() => {
    restoreSession()
    const on = () => { setOnline(true); guardSetOnline(true) }
    const off = () => { setOnline(false); guardSetOnline(false) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/gate/:tenantSlug/:gateSlug" element={<GateRoute />} />
        <Route path="/command/*" element={<CommandRoute />} />
        <Route path="/login" element={<CommandLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
`

// ─── 5. UPDATE AdmitPage — load destinations/purposes from tenant ──────────────

const admitPagePatch = `
  // Load tenant custom destinations and purposes
  const [tenantDestinations, setTenantDestinations] = useState(null)
  const [tenantPurposes, setTenantPurposes] = useState(null)

  useEffect(() => {
    async function loadConfig() {
      if (!effectiveTenant?.id) return
      const { data } = await supabase
        .from('tenants')
        .select('custom_destinations, custom_purposes')
        .eq('id', effectiveTenant.id)
        .single()
      if (data?.custom_destinations?.length > 0) setTenantDestinations(data.custom_destinations)
      if (data?.custom_purposes?.length > 0) setTenantPurposes(data.custom_purposes)
    }
    loadConfig()
  }, [effectiveTenant?.id])

  const activeDestinations = tenantDestinations || DESTINATIONS
  const activePurposes = tenantPurposes || PURPOSES
`

// ─── WRITE FILES ──────────────────────────────────────────────────────────────

console.log('Writing files...')

fs.writeFileSync('src/pages/auth/CommandLogin.jsx', commandLogin, 'utf8')
console.log('✓ CommandLogin.jsx — forgot password added')

fs.mkdirSync('src/pages/auth', { recursive: true })
fs.writeFileSync('src/pages/auth/ResetPassword.jsx', resetPasswordPage, 'utf8')
console.log('✓ ResetPassword.jsx — new page created')

fs.writeFileSync('src/pages/auth/OnboardingWizard.jsx', onboardingWizard, 'utf8')
console.log('✓ OnboardingWizard.jsx — 5-step wizard created')

fs.writeFileSync('src/App.jsx', appContent, 'utf8')
console.log('✓ App.jsx — new routes added')

// Patch AdmitPage to use dynamic destinations
let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')
if (!admit.includes('tenantDestinations')) {
  admit = admit.replace(
    '  const effectiveGate = gate || gateData\n  const effectiveTenant = tenant || tenantData',
    '  const effectiveGate = gate || gateData\n  const effectiveTenant = tenant || tenantData\n' + admitPagePatch
  )
  // Replace hardcoded DESTINATIONS/PURPOSES with dynamic ones
  admit = admit.replace(/value={destination}/g, 'value={destination}')
  admit = admit.replace(/{DESTINATIONS\.map/g, '{activeDestinations.map')
  admit = admit.replace(/{PURPOSES\.map/g, '{activePurposes.map')
  fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8')
  console.log('✓ AdmitPage.jsx — dynamic destinations/purposes from tenant config')
} else {
  console.log('✓ AdmitPage.jsx — already patched')
}

// Add onboarding_complete column to tenants via note (can't run SQL from here)
console.log('\nNOTE: Run this SQL in Supabase to add the onboarding column:')
console.log('alter table tenants add column if not exists onboarding_complete boolean default false;')
console.log('alter table tenants add column if not exists custom_destinations text[] default array[]::text[];')
console.log('alter table tenants add column if not exists custom_purposes text[] default array[]::text[];')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const loginContent = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')
const resetContent = fs.readFileSync('src/pages/auth/ResetPassword.jsx', 'utf8')
const wizardContent = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')
const appCont = fs.readFileSync('src/App.jsx', 'utf8')
const admitContent = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8')

const checks = {
  'Login: forgot password link': loginContent.includes('Forgot password'),
  'Login: handleForgotPassword': loginContent.includes('handleForgotPassword'),
  'Login: forgot mode': loginContent.includes("mode === 'forgot'"),
  'Reset page: updateUser call': resetContent.includes('updateUser'),
  'Reset page: password recovery event': resetContent.includes('PASSWORD_RECOVERY'),
  'Wizard: 5 steps': wizardContent.includes('step === 5'),
  'Wizard: sector selection': wizardContent.includes('SECTORS'),
  'Wizard: default destinations per sector': wizardContent.includes('DEFAULT_DESTINATIONS'),
  'Wizard: custom tag input': wizardContent.includes('setDestinations'),
  'Wizard: saves to supabase': wizardContent.includes('custom_destinations'),
  'App: reset-password route': appCont.includes('/reset-password'),
  'App: onboarding route': appCont.includes('/onboarding'),
  'AdmitPage: dynamic destinations': admitContent.includes('activeDestinations'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Onboarding wizard, forgot password, reset password, dynamic destinations"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nIMPORTANT: Run the SQL in Supabase before testing (see NOTE above)')
