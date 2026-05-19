export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', fontWeight: '700', color: 'var(--bg-4)', marginBottom: '16px' }}>404</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Page not found</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '24px' }}>
          This URL does not exist. If you are a gate officer, check the URL sent to your device.
        </p>
        <a href="/login" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px' }}>← Go to command login</a>
      </div>
    </div>
  )
}
