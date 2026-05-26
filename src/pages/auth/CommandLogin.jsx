import { useState } from 'react'
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

    // Use onboardingComplete from store login result — avoids second RLS-blocked query
    if (result.onboardingComplete === false) {
      navigate('/onboarding')
    } else {
      navigate('/command')
    }
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
