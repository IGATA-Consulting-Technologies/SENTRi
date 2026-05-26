import { useState } from 'react'
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
