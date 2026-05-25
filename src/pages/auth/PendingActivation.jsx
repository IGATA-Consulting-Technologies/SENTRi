import { useAuthStore } from '../../store'

export default function PendingActivation() {
  const { logout } = useAuthStore()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)' }}>
      <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }} className="fade-up">
        <div style={{ width: '72px', height: '72px', background: 'var(--amber-dim)', border: '2px solid var(--amber)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Account Pending</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '8px' }}>
          Your SENTRi account has been created and is pending activation by the IGATA Technologies team.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '28px' }}>
          You will receive an email confirmation once your account is active. This typically happens within 24 hours.
        </p>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '20px', textAlign: 'left' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', fontFamily: 'var(--font-display)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Need help?</div>
          <div style={{ fontSize: '13px', color: 'var(--text-1)' }}>Contact IGATA Technologies to expedite your activation or for any queries.</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
