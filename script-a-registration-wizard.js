const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Script A: Registration + Wizard + Store + Routing cleanup')
console.log('='.repeat(70))

const src = (p) => path.join(process.cwd(), p)

// ─────────────────────────────────────────────────────────────
// 1. store/index.js — login handles new accounts, add setTenantAndOfficer
// ─────────────────────────────────────────────────────────────
const storeContent = `import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      officer: null,
      tenant: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,
      isOnline: navigator.onLine,

      restoreSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { set({ isAuthenticated: false, officer: null, tenant: null }); return }
          const { data: officerData } = await supabase
            .from('officers').select('*, tenants(*)')
            .eq('id', session.user.id).eq('is_active', true).single()
          if (!officerData) {
            // Authenticated but no officer record yet — new account in wizard
            set({ isAuthenticated: true, officer: null, tenant: null })
            return
          }
          set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true })
        } catch (e) {
          console.error('Session restore error:', e)
          set({ isAuthenticated: false, officer: null, tenant: null })
        }
      },

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { set({ authLoading: false, authError: authError.message }); return { success: false } }

        const { data: officerData } = await supabase
          .from('officers').select('*, tenants(*)')
          .eq('id', authData.user.id).eq('is_active', true).single()

        if (!officerData) {
          // Valid auth user but no officer profile — send to onboarding
          set({ isAuthenticated: true, officer: null, tenant: null, authLoading: false, authError: null })
          return { success: true, newAccount: true }
        }

        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' })
          return { success: false }
        }

        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
        return { success: true, role: officerData.role, tenantId: officerData.tenant_id, onboardingComplete: officerData.tenants?.onboarding_complete }
      },

      // Called during wizard to populate store as records are created
      setTenantAndOfficer: (tenant, officer) => set({ tenant, officer }),

      logout: async () => {
        await supabase.auth.signOut()
        set({ officer: null, tenant: null, isAuthenticated: false })
      },

      setOnline: (val) => set({ isOnline: val }),
    }),
    {
      name: 'sentri-auth',
      partialize: (state) => ({
        officer: state.officer,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useGuardStore = create(
  persist(
    (set) => ({
      onShift: false,
      guard: null,
      gate: null,
      tenant: null,
      shiftStart: null,
      shiftLogId: null,
      activeTab: 'admit',
      setTenant: (tenant) => set({ tenant }),
      setGate: (gate) => set({ gate }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setOnline: (val) => set({ isOnline: val }),
      startShift: (guard, gate, tenant, shiftLogId) => set({
        onShift: true, guard, gate, tenant, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),
      endShift: () => set({
        onShift: false, guard: null, shiftLogId: null, shiftStart: null, activeTab: 'admit',
      }),
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (state) => ({
        onShift: state.onShift, guard: state.guard, gate: state.gate,
        tenant: state.tenant, shiftStart: state.shiftStart,
        shiftLogId: state.shiftLogId, activeTab: state.activeTab,
      }),
    }
  )
)
`
fs.writeFileSync(src('src/store/index.js'), storeContent, 'utf8')
console.log('✓ store/index.js — login handles new accounts, setTenantAndOfficer added')

// ─────────────────────────────────────────────────────────────
// 2. Register.jsx — new file, auth user only
// ─────────────────────────────────────────────────────────────
const registerContent = `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Full name is required'); return }
    if (!email.trim()) { setError('Email address is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)

    const { error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin + '/login'
      }
    })

    setLoading(false)
    if (authErr) { setError(authErr.message); return }
    setDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', marginBottom: '4px' }}>SENTRi</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>Create your account</p>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>by IGATA Technologies</p>
        </div>

        <div className="card" style={{ padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {!done ? (
            <form onSubmit={handleRegister}>
              <div className="field">
                <label>Full name *</label>
                <input type="text" placeholder="Your full name" value={name}
                  onChange={e => { setName(e.target.value); setError('') }}
                  autoCapitalize="words" autoComplete="name" />
              </div>
              <div className="field">
                <label>Email address *</label>
                <input type="email" placeholder="your@email.com" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  autoComplete="email" />
              </div>
              <div className="field">
                <label>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                    value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                    style={{ paddingRight: '44px' }} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', padding: '4px' }}>
                    {showPass
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div className="field" style={{ marginBottom: '24px' }}>
                <label>Confirm password *</label>
                <input type="password" placeholder="Repeat password"
                  value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  autoComplete="new-password" />
              </div>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || !name || !email || !password || !confirmPassword}>
                {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Creating account...</> : 'Create account →'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>📧</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '18px', marginBottom: '10px' }}>Check your email</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '8px' }}>
                We sent a confirmation link to <strong>{email}</strong>.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '24px' }}>
                Click the link in the email to confirm your address, then sign in to complete your installation setup.
              </p>
              <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
                Go to sign in
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-2)', marginTop: '16px' }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit' }}>
            Sign in
          </button>
        </p>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '8px' }}>
          Authorised personnel only · All access is logged and audited
        </p>
      </div>
    </div>
  )
}
`
fs.writeFileSync(src('src/pages/auth/Register.jsx'), registerContent, 'utf8')
console.log('✓ Register.jsx created — auth user only, clean 3-field form')

// ─────────────────────────────────────────────────────────────
// 3. CommandLogin.jsx — sign in only, link to /register
// ─────────────────────────────────────────────────────────────
const loginContent = `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabase'

export default function CommandLogin() {
  const { login, authLoading, authError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    let result
    try {
      const loginPromise = login(email.trim(), password)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. Please try again.')), 10000)
      )
      result = await Promise.race([loginPromise, timeoutPromise])
    } catch (err) { console.error('Login error:', err); return }

    if (!result?.success) return

    if (result.newAccount) { navigate('/onboarding'); return }
    if (result.role === 'admin') { navigate('/admin'); return }

    try {
      const { data: tenantData } = await supabase
        .from('tenants').select('onboarding_complete, is_active').eq('id', result.tenantId).single()
      if (tenantData && !tenantData.onboarding_complete) {
        navigate('/onboarding')
      } else {
        navigate('/command')
      }
    } catch { navigate('/command') }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email.trim()) { setForgotError('Please enter your email address'); return }
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + '/reset-password'
    })
    setForgotLoading(false)
    if (error) { setForgotError(error.message); return }
    setForgotSent(true)
  }

  const eyeIcon = (
    <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', padding: '4px' }}>
      {showPass
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', marginBottom: '4px' }}>SENTRi</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
            {mode === 'login' ? 'Command Dashboard' : 'Reset Password'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>by IGATA Technologies</p>
        </div>

        <div className="card" style={{ padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>

          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="your@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field" style={{ marginBottom: '8px' }}>
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Your password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" style={{ paddingRight: '44px' }} />
                  {eyeIcon}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button type="button" onClick={() => { setMode('forgot'); setForgotError(''); setForgotSent(false) }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Forgot password?
                </button>
              </div>
              {authError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {authError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full btn-lg"
                disabled={authLoading || !email || !password}>
                {authLoading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Signing in...</> : 'Sign in to command'}
              </button>
            </form>
          )}

          {mode === 'forgot' && !forgotSent && (
            <form onSubmit={handleForgotPassword}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                Enter your registered email and we will send a password reset link.
              </p>
              <div className="field" style={{ marginBottom: '20px' }}>
                <label>Email address</label>
                <input type="email" placeholder="your@email.com" value={email}
                  onChange={e => { setEmail(e.target.value); setForgotError('') }} autoComplete="email" />
              </div>
              {forgotError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{forgotError}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg"
                disabled={forgotLoading || !email}>
                {forgotLoading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Sending...</> : 'Send reset link'}
              </button>
              <button type="button" onClick={() => setMode('login')}
                style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Back to sign in
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotSent && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📧</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '8px' }}>Check your email</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
                Reset link sent to <strong>{email}</strong>.
              </p>
              <button className="btn btn-ghost btn-full" onClick={() => setMode('login')}>Back to sign in</button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-2)', marginTop: '16px' }}>
          New to SENTRi?{' '}
          <button onClick={() => navigate('/register')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit' }}>
            Create account →
          </button>
        </p>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '8px' }}>
          Authorised personnel only · All access is logged and audited
        </p>
      </div>
    </div>
  )
}
`
fs.writeFileSync(src('src/pages/auth/CommandLogin.jsx'), loginContent, 'utf8')
console.log('✓ CommandLogin.jsx — sign in only, forgot password, link to /register')

// ─────────────────────────────────────────────────────────────
// 4. OnboardingWizard.jsx — full rewrite, 6 steps, creates tenant+officer
// ─────────────────────────────────────────────────────────────
const wizardContent = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const SECTORS = [
  { value: 'military', label: 'Military / Defence', icon: '🛡️' },
  { value: 'oil_gas', label: 'Oil & Gas', icon: '⚙️' },
  { value: 'banking', label: 'Banking / Finance', icon: '🏦' },
  { value: 'corporate', label: 'Corporate', icon: '🏢' },
  { value: 'government', label: 'Government', icon: '🏛️' },
  { value: 'other', label: 'Other', icon: '🔒' },
]

const SECTOR_PROFILE = {
  military:    { idLabel: 'Service number', idPlaceholder: 'e.g. N/12345', rankLabel: 'Rank', rankPlaceholder: 'e.g. Colonel, Major', showRank: true },
  oil_gas:     { idLabel: 'Staff ID', idPlaceholder: 'e.g. OG/00123', rankLabel: 'Department', rankPlaceholder: 'e.g. HSE, Operations', showRank: false },
  banking:     { idLabel: 'Staff ID', idPlaceholder: 'e.g. BK/00123', rankLabel: 'Branch / Unit', rankPlaceholder: 'e.g. Security, Operations', showRank: false },
  corporate:   { idLabel: 'Employee ID', idPlaceholder: 'e.g. EMP/456', rankLabel: 'Department', rankPlaceholder: 'e.g. Facilities, Security', showRank: false },
  government:  { idLabel: 'Staff ID', idPlaceholder: 'e.g. GL07/1234', rankLabel: 'Ministry / Agency', rankPlaceholder: 'e.g. Ministry of Defence', showRank: false },
  other:       { idLabel: 'ID number', idPlaceholder: 'Your ID number', rankLabel: 'Department', rankPlaceholder: 'e.g. Security', showRank: false },
}

const DEFAULT_DESTINATIONS = {
  military:   ['Administration Block', 'Officers Mess', 'Barracks / Quarters', 'Armoury', 'Medical Centre', 'Sports Complex', 'Provost Office', 'Signals Unit', 'Quartermaster Store', 'Commanding Officer Office'],
  oil_gas:    ['Control Room', 'Wellhead Area', 'Refinery Block', 'Admin Building', 'Warehouse', 'Maintenance Bay', 'HSE Office', 'Canteen', 'Medical Bay', 'Security Post'],
  banking:    ['Banking Hall', 'Vault Area', 'Executive Floor', 'IT Room', 'HR Office', 'Board Room', 'Customer Service', 'Back Office', 'ATM Room', 'Security Room'],
  corporate:  ['Reception', 'Executive Suite', 'Conference Room', 'IT Department', 'Finance', 'HR Department', 'Operations', 'Warehouse', 'Cafeteria', 'Server Room'],
  government: ['Registry', 'Executive Office', 'Conference Room', 'Finance Department', 'HR Office', 'IT Unit', 'Public Relations', 'Security Post', 'Archives', 'Board Room'],
  other:      ['Main Office', 'Reception', 'Meeting Room', 'Warehouse', 'Security Post', 'Management Office', 'Staff Area', 'Visitor Lounge'],
}

const DEFAULT_PURPOSES = {
  military:   ['Official visit', 'Delivery / Supply', 'Maintenance / Repair', 'Training', 'Personal visit', 'Medical', 'Contractor / Vendor'],
  oil_gas:    ['Official visit', 'Contractor / Vendor', 'HSE Inspection', 'Maintenance', 'Delivery', 'Emergency Response', 'Audit', 'Training'],
  banking:    ['Official visit', 'Audit', 'IT Support', 'Delivery', 'Meeting', 'Contractor', 'Regulatory Visit', 'Training'],
  corporate:  ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Interview', 'Training', 'Client Visit'],
  government: ['Official visit', 'Meeting', 'Delivery', 'Audit', 'Inspection', 'Contractor', 'Training', 'Personal visit'],
  other:      ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Personal visit', 'Training'],
}

const TOTAL_STEPS = 6

export default function OnboardingWizard() {
  const { setTenantAndOfficer } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Get logged in user
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        setUserEmail(session.user.email)
        setUserName(session.user.user_metadata?.full_name || '')
      }
    })
  }, [])

  // Step 1 — Installation
  const [installationName, setInstallationName] = useState('')
  const [sector, setSector] = useState('military')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')

  // Step 2 — Profile (sector-aware officer fields)
  const [officerName, setOfficerName] = useState('')
  const [rank, setRank] = useState('')
  const [serviceNumber, setServiceNumber] = useState('')

  // Created records (passed between steps)
  const [tenantId, setTenantId] = useState(null)
  const [tenantSlug, setTenantSlug] = useState(null)

  // Step 3 — Destinations
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS['military'])
  const [newDest, setNewDest] = useState('')

  // Step 4 — Purposes
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES['military'])
  const [newPurpose, setNewPurpose] = useState('')

  // Step 5 — Gates
  const [gates, setGates] = useState([{ name: '', location: '' }])
  const [createdGates, setCreatedGates] = useState([])
  const [copied, setCopied] = useState(null)

  function handleSectorChange(s) {
    setSector(s)
    setDestinations(DEFAULT_DESTINATIONS[s] || DEFAULT_DESTINATIONS.other)
    setPurposes(DEFAULT_PURPOSES[s] || DEFAULT_PURPOSES.other)
  }

  function err(msg) { setError(msg); setSaving(false) }

  // Step 1 — Create tenant
  async function saveStep1() {
    if (!installationName.trim()) { err('Installation name is required'); return }
    if (!sector) { err('Please select your sector'); return }
    setSaving(true); setError('')
    const slug = installationName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error: e } = await supabase.from('tenants').insert({
      name: installationName.trim(),
      slug,
      sector,
      city: city.trim(),
      state: stateName.trim(),
      is_active: true,
      onboarding_complete: false,
      custom_destinations: [],
      custom_purposes: [],
    }).select().single()
    if (e) { err('Could not create installation: ' + e.message); return }
    setTenantId(data.id)
    setTenantSlug(slug)
    setSaving(false)
    setStep(2)
  }

  // Step 2 — Create officer
  async function saveStep2() {
    if (!officerName.trim()) { err('Your name is required'); return }
    const profile = SECTOR_PROFILE[sector] || SECTOR_PROFILE.other
    if (!serviceNumber.trim()) { err(profile.idLabel + ' is required'); return }
    setSaving(true); setError('')
    const { data, error: e } = await supabase.from('officers').insert({
      id: userId,
      name: officerName.trim(),
      rank: rank.trim() || null,
      email: userEmail,
      service_number: serviceNumber.trim().toUpperCase(),
      tenant_id: tenantId,
      role: 'command',
      is_active: true,
    }).select('*, tenants(*)').single()
    if (e) { err('Could not create profile: ' + e.message); return }
    // Populate auth store so command dashboard works after wizard
    setTenantAndOfficer(data.tenants, data)
    setSaving(false)
    setStep(3)
  }

  // Step 3 — Save destinations
  async function saveStep3() {
    if (destinations.length === 0) { err('Add at least one destination'); return }
    setSaving(true); setError('')
    await supabase.from('tenants').update({ custom_destinations: destinations }).eq('id', tenantId)
    setSaving(false); setStep(4)
  }

  // Step 4 — Save purposes
  async function saveStep4() {
    if (purposes.length === 0) { err('Add at least one purpose'); return }
    setSaving(true); setError('')
    await supabase.from('tenants').update({ custom_purposes: purposes }).eq('id', tenantId)
    setSaving(false); setStep(5)
  }

  // Step 5 — Create gates
  async function saveStep5() {
    const validGates = gates.filter(g => g.name.trim())
    if (validGates.length === 0) { err('Add at least one gate'); return }
    setSaving(true); setError('')
    const created = []
    for (const g of validGates) {
      const gSlug = g.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
        + '-' + Math.random().toString(36).slice(2, 6)
      const { data } = await supabase.from('gates').insert({
        tenant_id: tenantId,
        name: g.name.trim(),
        slug: gSlug,
        location: g.location.trim() || null,
        is_active: true,
      }).select().single()
      if (data) created.push({ ...data, url: window.location.origin + '/gate/' + tenantSlug + '/' + gSlug })
    }
    setCreatedGates(created)
    // Mark onboarding complete and fire notification email
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    try {
      await fetch('/.netlify/functions/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ['igataprojects@gmail.com'],
          subject: 'New SENTRi Installation Ready — ' + installationName.trim(),
          html: \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:28px;">
                <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">SENTRi</div>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">New Installation Ready</div>
              </div>
              <div style="padding:28px;">
                <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a2e;">Setup complete</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;width:40%;">Installation</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">\${installationName.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Sector</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">\${sector}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Officer</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">\${rank.trim() ? rank.trim() + ' ' : ''}\${officerName.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">\${userEmail}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Gates</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">\${created.length} gate(s) created</td></tr>
                  <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;">Completed</td><td style="padding:8px 0;font-size:14px;">\${new Date().toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                </table>
                <a href="https://sentri-igata.netlify.app/admin" style="display:block;margin-top:24px;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View in Superadmin →</a>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #e2e6ed;font-size:11px;color:#9ca3af;">IGATA Technologies · SENTRi Platform</div>
            </div>
          </body></html>\`
        })
      })
    } catch (e) { console.error('Notification email error:', e) }
    setSaving(false)
    setStep(6)
  }

  function copyUrl(gate) {
    navigator.clipboard.writeText(gate.url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const profile = SECTOR_PROFILE[sector] || SECTOR_PROFILE.other
  const stepLabels = ['Installation', 'Profile', 'Destinations', 'Purposes', 'Gates', 'Done']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '52px', height: '52px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(26,86,219,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Welcome to SENTRi</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
        </div>

        {step < 6 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              {stepLabels.slice(0, 5).map((label, i) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-3)', color: step >= i + 1 ? 'white' : 'var(--text-2)' }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '9px', color: step === i + 1 ? 'var(--accent)' : 'var(--text-2)', fontWeight: step === i + 1 ? '700' : '400', textAlign: 'center' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: ((step - 1) / 5 * 100) + '%', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* STEP 1 — Installation */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your installation</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Tell us about your facility.</p>

            <div className="field">
              <label>Installation name *</label>
              <input type="text" placeholder="e.g. Ikeja Cantonment, Shell SPDC Port Harcourt"
                value={installationName} onChange={e => { setInstallationName(e.target.value); setError('') }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
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
                <label>City</label>
                <input type="text" placeholder="e.g. Lagos" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>State</label>
                <input type="text" placeholder="e.g. Lagos State" value={stateName} onChange={e => setStateName(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: '8px' }} onClick={saveStep1} disabled={saving || !installationName.trim()}>
              {saving ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</> : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 2 — Profile */}
        {step === 2 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your profile</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              This creates your command officer account for {installationName}.
            </p>

            <div className="field">
              <label>Full name *</label>
              <input type="text" placeholder="Your full name" value={officerName || userName}
                onChange={e => { setOfficerName(e.target.value); setError('') }} autoCapitalize="words" />
            </div>

            {profile.showRank && (
              <div className="field">
                <label>{profile.rankLabel}</label>
                <input type="text" placeholder={profile.rankPlaceholder} value={rank}
                  onChange={e => setRank(e.target.value)} autoCapitalize="words" />
              </div>
            )}

            {!profile.showRank && (
              <div className="field">
                <label>{profile.rankLabel}</label>
                <input type="text" placeholder={profile.rankPlaceholder} value={rank}
                  onChange={e => setRank(e.target.value)} />
              </div>
            )}

            <div className="field" style={{ marginBottom: '24px' }}>
              <label>{profile.idLabel} *</label>
              <input type="text" placeholder={profile.idPlaceholder} value={serviceNumber}
                onChange={e => { setServiceNumber(e.target.value.toUpperCase()); setError('') }}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep2}
                disabled={saving || !serviceNumber.trim()}>
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
              Locations inside your facility that visitors are going to. Pre-filled for your sector — edit freely.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{dest}</span>
                  <button onClick={() => setDestinations(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a destination..." value={newDest}
                onChange={e => setNewDest(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep3} disabled={saving}>
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
              Why do visitors come to your facility? Pre-filled for your sector — edit freely.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {purposes.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{p}</span>
                  <button onClick={() => setPurposes(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a visit purpose..." value={newPurpose}
                onChange={e => setNewPurpose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep4} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Gates */}
        {step === 5 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your gates</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Add every gate or entry point. Each gets a unique URL — send it to the guard's phone via WhatsApp.
            </p>
            {gates.map((gate, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate {i + 1}</span>
                  {gates.length > 1 && <button onClick={() => setGates(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                </div>
                <div className="field-row">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Gate name *</label>
                    <input type="text" placeholder="e.g. Main Gate" value={gate.name}
                      onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Location (optional)</label>
                    <input type="text" placeholder="e.g. North entrance" value={gate.location}
                      onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, location: e.target.value } : g))} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-full" style={{ marginBottom: '20px' }}
              onClick={() => setGates(prev => [...prev, { name: '', location: '' }])}>
              + Add another gate
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(4)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep5}
                disabled={saving || !gates.some(g => g.name.trim())}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Creating gates...</> : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6 — Done */}
        {step === 6 && (
          <div className="card fade-up" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 24px rgba(14,124,58,0.25)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
              {installationName} is live!
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: '1.6' }}>
              Your installation is fully set up. Copy your gate URLs below and send them to your guards via WhatsApp.
            </p>

            {createdGates.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Gate URLs</div>
                {createdGates.map(gate => (
                  <div key={gate.id} className="card" style={{ marginBottom: '10px', padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>{gate.name}</div>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '10px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                      {gate.url}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => copyUrl(gate)}>
                      {copied === gate.id ? '✓ Copied!' : 'Copy URL'}
                    </button>
                  </div>
                ))}
              </div>
            )}

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
fs.writeFileSync(src('src/pages/auth/OnboardingWizard.jsx'), wizardContent, 'utf8')
console.log('✓ OnboardingWizard.jsx — 6 steps, creates tenant+officer, gates last with URLs')

// ─────────────────────────────────────────────────────────────
// 5. App.jsx — add /register, remove /pending
// ─────────────────────────────────────────────────────────────
const appContent = `import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuthStore, useGuardStore } from './store'
import GateApp from './pages/gate/GateApp'
import CommandApp from './pages/command/CommandApp'
import AdminApp from './pages/admin/AdminApp'
import CommandLogin from './pages/auth/CommandLogin'
import Register from './pages/auth/Register'
import ResetPassword from './pages/auth/ResetPassword'
import OnboardingWizard from './pages/auth/OnboardingWizard'
import NotFound from './pages/NotFound'
import PWAInstallPrompt from './components/PWAInstallPrompt'

function GateRoute() {
  const { tenantSlug, gateSlug } = useParams()
  return <GateApp tenantSlug={tenantSlug} gateSlug={gateSlug} />
}

function CommandRoute() {
  const { isAuthenticated, officer } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!officer) return <Navigate to="/onboarding" replace />
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
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <PWAInstallPrompt />
    </BrowserRouter>
  )
}
`
fs.writeFileSync(src('src/App.jsx'), appContent, 'utf8')
console.log('✓ App.jsx — /register added, /pending removed, CommandRoute handles new accounts')

// ─────────────────────────────────────────────────────────────
// 6. Delete dead files
// ─────────────────────────────────────────────────────────────
const toDelete = [
  'src/pages/auth/PendingActivation.jsx',
  'src/pages/command/IntelligenceTab.jsx',
]
toDelete.forEach(p => {
  const full = src(p)
  if (fs.existsSync(full)) { fs.unlinkSync(full); console.log('✓ Deleted:', p) }
  else { console.log('— Already gone:', p) }
})

// ─────────────────────────────────────────────────────────────
// 7. Remove Intelligence from CommandApp
// ─────────────────────────────────────────────────────────────
const commandPath = src('src/pages/command/CommandApp.jsx')
let commandContent = fs.readFileSync(commandPath, 'utf8').replace(/^\uFEFF/, '')

commandContent = commandContent.replace(`import IntelligenceTab from './IntelligenceTab'\n`, '')
commandContent = commandContent.replace(`  { key: 'intelligence', label: 'Intelligence' },\n`, '')
commandContent = commandContent.replace(`      case 'intelligence': return <IntelligenceTab />\n`, '')
// Fix styling back to uniform — remove intelligence-specific style logic
commandContent = commandContent.replace(
  `background: activeTab === tab.key ? (tab.key === 'intelligence' ? '#0a0f1e' : 'var(--accent)') : tab.key === 'intelligence' ? 'rgba(10,15,30,0.06)' : 'transparent',
              color: activeTab === tab.key ? 'white' : tab.key === 'intelligence' ? '#0a0f1e' : 'var(--text-1)',
              fontWeight: tab.key === 'intelligence' ? 700 : 500,`,
  `background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-1)',
              fontWeight: 500,`
)

fs.writeFileSync(commandPath, commandContent, 'utf8')
console.log('✓ CommandApp.jsx — Intelligence tab removed, styling cleaned')

// ─────────────────────────────────────────────────────────────
// Git
// ─────────────────────────────────────────────────────────────
try {
  execSync('git add -A', { stdio: 'inherit' })
  execSync('git commit -m "Rebuild: clean registration flow, 6-step wizard, remove dead files and Intelligence tab"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('\nScript A complete.')
console.log('Flow: /register → email confirm → /login → /onboarding (6 steps) → /command')
console.log('Next: Script B — Report tab merge with all analytics + two download buttons')
