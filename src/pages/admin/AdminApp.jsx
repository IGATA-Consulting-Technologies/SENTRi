// AdminApp.jsx — IGATA Superadmin (placeholder for Phase 4)
import { useAuthStore } from '../../store'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminApp() {
  const { officer, logout } = useAuthStore()
  const [tenants, setTenants] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: allTenants } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    setTenants(allTenants || [])
    setStats({ total: (allTenants || []).length, active: (allTenants || []).filter(t => t.is_active).length })
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700' }}>SENTRi Admin</div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>IGATA Technologies · Platform Control</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Platform Overview</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>All installations on SENTRi</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[{ label: 'Total tenants', value: stats.total }, { label: 'Active', value: stats.active }, { label: 'Inactive', value: (stats.total || 0) - (stats.active || 0) }].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', marginBottom: '6px', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--text-0)' }}>{s.value ?? '—'}</div>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginBottom: '12px' }}>All installations</div>
        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>Loading…</div>
          : tenants.map(t => (
            <div key={t.id} className="card" style={{ marginBottom: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>{t.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{t.sector} · {t.city}, {t.state} · Slug: {t.slug}</div>
              </div>
              <span className={`pill ${t.is_active ? 'pill-green' : 'pill-gray'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
