import { useState, useEffect } from 'react'
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
