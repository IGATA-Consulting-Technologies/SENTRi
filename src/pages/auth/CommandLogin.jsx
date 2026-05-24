import { useState } from 'react'
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
