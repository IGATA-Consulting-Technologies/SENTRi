// SENTRi — Complete Superadmin Rebuild + Approval Flow
// Run with: node --input-type=commonjs < superadmin_build.js

const fs = require('fs')
const { execSync } = require('child_process')

const adminApp = `import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'IGATASentri@Admin2024'
const SECTORS = ['military', 'oil_gas', 'banking', 'corporate', 'government', 'other']
const PLANS = ['starter', 'command', 'intelligence']

const PLAN_COLORS = {
  starter: { bg: 'rgba(14,124,58,0.08)', color: '#0e7c3a' },
  command: { bg: 'rgba(26,86,219,0.08)', color: '#1a56db' },
  intelligence: { bg: 'rgba(146,83,10,0.08)', color: '#92530a' }
}

// ── Shared send email helper ──
async function sendAdminEmail(to, subject, html) {
  try {
    await fetch('/.netlify/functions/send-alert-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: Array.isArray(to) ? to : [to], subject, html })
    })
  } catch (e) { console.error('Admin email error:', e) }
}

// ── Login Screen ──
function LoginScreen({ onAuth }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  function login() {
    if (secret === ADMIN_SECRET) { onAuth() }
    else { setError('Invalid superadmin key') }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #0a0f1e 0%, #0f1923 50%, #1a2235 100%)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(26,86,219,0.2)', border: '1px solid rgba(26,86,219,0.4)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div style={{ color: 'white', fontSize: '26px', fontWeight: '800', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', marginBottom: '4px' }}>SENTRi</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Superadmin Console</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '4px' }}>IGATA Technologies</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '28px' }}>
          {error && <div style={{ background: 'rgba(192,19,42,0.15)', border: '1px solid rgba(192,19,42,0.3)', borderRadius: '8px', padding: '10px', color: '#ff6b7a', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
          <input type="password" placeholder="Enter superadmin key" value={secret}
            onChange={e => { setSecret(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'white', fontSize: '14px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '12px', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={login} style={{ width: '100%', padding: '13px', background: '#1a56db', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-display)', cursor: 'pointer', letterSpacing: '0.02em' }}>
            Access Console
          </button>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '20px' }}>Restricted access · All activity logged</div>
      </div>
    </div>
  )
}

// ── Overview Tab ──
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [recentMovements, setRecentMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [tenants, movements, todayMov, weekMov, monthMov, incidents, officers, gates, flags, pending, recent] = await Promise.all([
      supabase.from('tenants').select('id,is_active'),
      supabase.from('movements').select('id,exit_time', { count: 'exact' }),
      supabase.from('movements').select('id', { count: 'exact' }).gte('entry_time', today.toISOString()),
      supabase.from('movements').select('id', { count: 'exact' }).gte('entry_time', weekAgo.toISOString()),
      supabase.from('movements').select('id', { count: 'exact' }).gte('entry_time', monthAgo.toISOString()),
      supabase.from('incidents').select('id,severity,status'),
      supabase.from('officers').select('id', { count: 'exact' }),
      supabase.from('gates').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('flag_alerts').select('id', { count: 'exact' }),
      supabase.from('tenants').select('id', { count: 'exact' }).eq('is_active', false),
      supabase.from('movements').select('id,plate_number,visitor_name,type,entry_time,flag_triggered,tenants(name),gates(name)').order('entry_time', { ascending: false }).limit(10)
    ])

    setStats({
      totalTenants: (tenants.data || []).length,
      activeTenants: (tenants.data || []).filter(t => t.is_active).length,
      pendingTenants: pending.count || 0,
      totalMovements: movements.count || 0,
      todayMovements: todayMov.count || 0,
      weekMovements: weekMov.count || 0,
      monthMovements: monthMov.count || 0,
      insideNow: (movements.data || []).filter(m => !m.exit_time).length,
      openIncidents: (incidents.data || []).filter(i => i.status === 'open').length,
      criticalIncidents: (incidents.data || []).filter(i => i.severity === 'critical' && i.status !== 'resolved').length,
      totalOfficers: officers.count || 0,
      activeGates: gates.count || 0,
      totalFlags: flags.count || 0,
    })
    setRecentMovements(recent.data || [])
    setLoading(false)
  }

  if (loading) return <LoadingState />

  const statCards = [
    { label: 'Active Tenants', value: stats.activeTenants, sub: stats.pendingTenants > 0 ? stats.pendingTenants + ' pending' : null, color: '#0e7c3a' },
    { label: 'Today', value: stats.todayMovements, sub: 'movements', color: '#1a56db' },
    { label: 'This Week', value: stats.weekMovements, sub: 'movements', color: '#1a56db' },
    { label: 'This Month', value: stats.monthMovements, sub: 'movements', color: '#1a56db' },
    { label: 'Inside Now', value: stats.insideNow, sub: 'across all gates', color: '#92530a' },
    { label: 'Open Incidents', value: stats.openIncidents, sub: stats.criticalIncidents > 0 ? stats.criticalIncidents + ' critical' : null, color: stats.openIncidents > 0 ? '#c0132a' : '#1a1a2e' },
    { label: 'Flag Alerts', value: stats.totalFlags, sub: 'all time', color: '#c0132a' },
    { label: 'Gates Deployed', value: stats.activeGates, sub: 'across all clients', color: '#1a56db' },
    { label: 'Officers', value: stats.totalOfficers, sub: 'registered', color: '#1a1a2e' },
    { label: 'Total Movements', value: stats.totalMovements, sub: 'all time', color: '#1a1a2e' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Platform Overview</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Real-time intelligence across all SENTRi installations.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '32px', fontWeight: '700', fontFamily: 'var(--font-display)', color: s.color, lineHeight: 1, marginBottom: s.sub ? '4px' : 0 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: '12px' }}>Live Feed — Last 10 Movements</h3>
        {recentMovements.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)' }}>No recent movements</div>
        ) : (
          recentMovements.map(m => (
            <div key={m.id} className="card" style={{ marginBottom: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: m.flag_triggered ? '3px solid var(--red)' : '1px solid var(--border)' }}>
              {m.flag_triggered && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  {m.plate_number && <span className="plate" style={{ fontSize: '12px' }}>{m.plate_number}</span>}
                  {m.visitor_name && <span style={{ fontSize: '13px', fontWeight: '600' }}>{m.visitor_name}</span>}
                  {m.flag_triggered && <span className="pill pill-red" style={{ fontSize: '10px' }}>Flagged</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{m.tenants?.name} · {m.gates?.name}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', flexShrink: 0 }}>
                {new Date(m.entry_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Tenants Tab ──
function TenantsTab() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', sector: 'military', city: '', state: '', plan: 'starter' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*, gates(id), officers(id), movements(id)').order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }

  async function activate(t) {
    await supabase.from('tenants').update({ is_active: true }).eq('id', t.id)
    // Send activation email
    if (t.contact_email) {
      await sendAdminEmail(t.contact_email, 'Your SENTRi account is now active — ' + t.name,
        \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:#0e7c3a;padding:28px;"><div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">🛡️ SENTRi</div><div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Account Activated</div></div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1a1a2e;">Welcome to SENTRi, \${t.name}!</h2>
            <p style="font-size:14px;color:#6b7280;margin-bottom:20px;">Your SENTRi command account has been activated. You can now sign in and begin setting up your installation.</p>
            <a href="https://sentri-igata.netlify.app/login" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Sign in to SENTRi →</a>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;"><span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span><span style="font-size:11px;color:#9ca3af;">SENTRi Intelligence</span></div>
        </div></body></html>\`
      )
    }
    load()
  }

  async function deactivate(t) {
    await supabase.from('tenants').update({ is_active: false }).eq('id', t.id)
    load()
  }

  async function updatePlan(t, plan) {
    await supabase.from('tenants').update({ plan }).eq('id', t.id)
    load()
  }

  async function createTenant() {
    setFormError('')
    if (!form.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { error } = await supabase.from('tenants').insert({
      name: form.name.trim(), slug, sector: form.sector,
      city: form.city.trim(), state: form.state.trim(),
      plan: form.plan, is_active: true,
      custom_destinations: [], custom_purposes: [], onboarding_complete: false
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setShowForm(false)
    setForm({ name: '', sector: 'military', city: '', state: '', plan: 'starter' })
    load()
  }

  const filtered = filter === 'all' ? tenants : filter === 'pending' ? tenants.filter(t => !t.is_active) : tenants.filter(t => t.is_active)

  if (selected) return <TenantProfile tenant={selected} onBack={() => { setSelected(null); load() }} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Tenants</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{tenants.length} installations registered</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New tenant'}
        </button>
      </div>

      {showForm && (
        <div className="card fade-up" style={{ marginBottom: '20px', border: '1.5px solid var(--accent)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', color: 'var(--accent)', marginBottom: '16px' }}>Create tenant manually</div>
          <div className="field-row" style={{ marginBottom: '10px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Installation name *</label>
              <input type="text" placeholder="e.g. Ikeja Cantonment" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Sector</label>
              <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: '10px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>City</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>State</label>
              <input type="text" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label>Plan</label>
            <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
              {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
          <button className="btn btn-primary" onClick={createTenant} disabled={saving}>
            {saving ? 'Creating...' : 'Create tenant'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {['all', 'active', 'pending'].map(f => (
          <button key={f} className={'filter-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : filtered.map(t => (
        <div key={t.id} className="card" style={{ marginBottom: '10px', padding: '16px 18px', opacity: t.is_active ? 1 : 0.75 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px' }}>{t.name}</span>
                <span className={'pill ' + (t.is_active ? 'pill-green' : 'pill-amber')}>{t.is_active ? 'Active' : 'Pending'}</span>
                {t.plan && <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: PLAN_COLORS[t.plan]?.bg, color: PLAN_COLORS[t.plan]?.color }}>{t.plan}</span>}
                {t.sector && <span className="pill pill-gray">{t.sector}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px' }}>
                {t.city && t.state ? t.city + ', ' + t.state : t.slug}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-2)' }}>
                <span>🚪 {(t.gates || []).length} gates</span>
                <span>👮 {(t.officers || []).length} officers</span>
                <span>📊 {(t.movements || []).length} movements</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setSelected(t)}>View</button>
              {!t.is_active
                ? <button className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', border: 'none' }} onClick={() => activate(t)}>Activate</button>
                : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deactivate(t)}>Deactivate</button>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tenant Profile (drill-down) ──
function TenantProfile({ tenant, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(tenant.plan || 'starter')
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [gates, officers, movements, incidents, flags] = await Promise.all([
      supabase.from('gates').select('*').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('officers').select('*').eq('tenant_id', tenant.id),
      supabase.from('movements').select('id,type,flag_triggered,entry_time').eq('tenant_id', tenant.id).gte('entry_time', since),
      supabase.from('incidents').select('id,severity,status,type,created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('flag_alerts').select('id').eq('tenant_id', tenant.id)
    ])
    setData({
      gates: gates.data || [],
      officers: officers.data || [],
      movements: movements.data || [],
      incidents: incidents.data || [],
      flags: flags.data || [],
    })
    setLoading(false)
  }

  async function savePlan() {
    setSavingPlan(true)
    await supabase.from('tenants').update({ plan }).eq('id', tenant.id)
    setSavingPlan(false)
  }

  if (loading) return <LoadingState />

  const vehicles = data.movements.filter(m => m.type === 'vehicle').length
  const flagged = data.movements.filter(m => m.flag_triggered).length

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14px', marginBottom: '20px', padding: 0 }}>
        ← All tenants
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{tenant.name}</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className={'pill ' + (tenant.is_active ? 'pill-green' : 'pill-amber')}>{tenant.is_active ? 'Active' : 'Pending'}</span>
            {tenant.sector && <span className="pill pill-gray">{tenant.sector}</span>}
            {tenant.city && <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{tenant.city}, {tenant.state}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={plan} onChange={e => setPlan(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border-med)', background: 'var(--bg-1)', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '600' }}>
            {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={savingPlan}>
            {savingPlan ? 'Saving...' : 'Set plan'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'Movements (30d)', value: data.movements.length, color: '#1a56db' },
          { label: 'Vehicles', value: vehicles, color: '#1a1a2e' },
          { label: 'Flag Hits (30d)', value: flagged, color: flagged > 0 ? '#c0132a' : '#1a1a2e' },
          { label: 'Total Flag Alerts', value: data.flags.length, color: data.flags.length > 0 ? '#c0132a' : '#1a1a2e' },
          { label: 'Gates', value: data.gates.length, color: '#1a56db' },
          { label: 'Officers', value: data.officers.length, color: '#1a1a2e' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Gates */}
      {data.gates.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-label" style={{ marginBottom: '12px' }}>Gates</div>
          {data.gates.map(g => (
            <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <span style={{ fontWeight: '600' }}>{g.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{g.slug}</span>
            </div>
          ))}
        </div>
      )}

      {/* Officers */}
      {data.officers.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-label" style={{ marginBottom: '12px' }}>Officers</div>
          {data.officers.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <div>
                <span style={{ fontWeight: '600' }}>{o.rank} {o.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-2)', marginLeft: '8px' }}>{o.role}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{o.email}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Incidents */}
      {data.incidents.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-label" style={{ marginBottom: '12px' }}>Recent Incidents</div>
          {data.incidents.map(inc => (
            <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{inc.type.replace(/_/g, ' ')}</span>
                <span className={'pill ' + (inc.severity === 'critical' ? 'pill-red' : inc.severity === 'serious' ? 'pill-amber' : 'pill-blue')}>{inc.severity}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{new Date(inc.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Registration Requests Tab ──
function RequestsTab() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tenants')
      .select('*, officers(name, rank, email, role)')
      .eq('is_active', false)
      .order('created_at', { ascending: false })
    setPending(data || [])
    setLoading(false)
  }

  async function activate(t) {
    setActivating(t.id)
    await supabase.from('tenants').update({ is_active: true }).eq('id', t.id)
    const officer = (t.officers || [])[0]
    if (officer?.email) {
      await sendAdminEmail(officer.email,
        'Your SENTRi account is now active — ' + t.name,
        \`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:#0e7c3a;padding:28px;"><div style="color:white;font-size:20px;font-weight:800;">🛡️ SENTRi</div><div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Account Activated</div></div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1a1a2e;">Welcome to SENTRi!</h2>
            <p style="font-size:14px;color:#6b7280;margin-bottom:8px;">Hello \${officer.rank || ''} \${officer.name},</p>
            <p style="font-size:14px;color:#6b7280;margin-bottom:20px;">Your SENTRi command account for <strong>\${t.name}</strong> has been activated. Sign in to complete your setup.</p>
            <a href="https://sentri-igata.netlify.app/login" style="display:block;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Sign in to SENTRi →</a>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #e2e6ed;display:flex;justify-content:space-between;"><span style="font-size:11px;color:#9ca3af;">Powered by IGATA Technologies</span><span style="font-size:11px;color:#9ca3af;">SENTRi Intelligence</span></div>
        </div></body></html>\`
      )
    }
    setActivating(null)
    load()
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Registration Requests</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Accounts pending your activation. Activate after confirming payment.</p>
      </div>

      {loading ? <LoadingState /> : pending.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>No pending registrations.</p>
        </div>
      ) : pending.map(t => {
        const officer = (t.officers || [])[0]
        return (
          <div key={t.id} className="card" style={{ marginBottom: '12px', padding: '18px', borderLeft: '3px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{t.name}</div>
                {officer && (
                  <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '4px' }}>
                    {officer.rank} {officer.name} · {officer.email}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                  {t.sector && <span style={{ marginRight: '12px' }}>{t.sector}</span>}
                  {t.city && <span>{t.city}, {t.state}</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Registered {new Date(t.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--green)', color: 'white', border: 'none', flexShrink: 0 }}
                onClick={() => activate(t)}
                disabled={activating === t.id}
              >
                {activating === t.id ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Officers Tab ──
function OfficersTab() {
  const [officers, setOfficers] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTenant, setFilterTenant] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('officers').select('*, tenants(name)').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id,name').eq('is_active', true).order('name')
    ]).then(([o, t]) => { setOfficers(o.data || []); setTenants(t.data || []); setLoading(false) })
  }, [])

  async function toggle(o) {
    await supabase.from('officers').update({ is_active: !o.is_active }).eq('id', o.id)
    const { data } = await supabase.from('officers').select('*, tenants(name)').order('created_at', { ascending: false })
    setOfficers(data || [])
  }

  const filtered = officers
    .filter(o => filterTenant === 'all' || o.tenant_id === filterTenant)
    .filter(o => !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Officers</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{filtered.length} officers across all installations</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '9px 14px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
          style={{ padding: '9px 14px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)' }}>
          <option value="all">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {loading ? <LoadingState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(o => (
            <div key={o.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', opacity: o.is_active ? 1 : 0.6 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{o.rank} {o.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{o.email} · {o.tenants?.name}</div>
              </div>
              <span className={'pill ' + (o.role === 'command' ? 'pill-blue' : 'pill-gray')} style={{ fontSize: '10px' }}>{o.role}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: o.is_active ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} onClick={() => toggle(o)}>
                {o.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Incidents Tab ──
function AdminIncidentsTab() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase.from('incidents')
      .select('*, tenants(name), gates(name)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setIncidents(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>All Incidents</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Platform-wide incident feed across all installations.</p>
      </div>
      <div className="filter-row" style={{ marginBottom: '16px' }}>
        {['open', 'acknowledged', 'resolved', 'all'].map(f => (
          <button key={f} className={'filter-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <LoadingState /> : incidents.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>No {filter !== 'all' ? filter : ''} incidents.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {incidents.map(inc => (
            <div key={inc.id} className={'incident-card severity-' + inc.severity}>
              <div className="incident-title-row">
                <span className="incident-type">{inc.type.replace(/_/g, ' ')}</span>
                <span className={'badge ' + (inc.severity === 'critical' ? 'badge-red' : inc.severity === 'serious' ? 'badge-amber' : 'badge-blue')}>{inc.severity}</span>
                <span className={'badge ' + (inc.status === 'open' ? 'badge-red' : inc.status === 'acknowledged' ? 'badge-amber' : 'badge-green')}>{inc.status}</span>
              </div>
              <div className="incident-meta" style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '600', color: 'var(--accent)' }}>{inc.tenants?.name}</span>
                {inc.gates?.name && <span> · {inc.gates.name}</span>}
                <span> · {new Date(inc.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {inc.description && <p className="incident-description">{inc.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings Tab ──
function SettingsTab() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Settings</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Platform configuration for IGATA Technologies.</p>
      </div>
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="section-label" style={{ marginBottom: '8px' }}>Platform</div>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>SENTRi Movement Intelligence</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px' }}>Version 1.0 · Phase 1</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>Built by IGATA Technologies</div>
      </div>
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="section-label" style={{ marginBottom: '8px' }}>Plan Tiers</div>
        {[
          { name: 'Starter', price: '₦150,000/mo', features: 'Up to 2 gates, weekly digest, flag alerts' },
          { name: 'Command', price: '₦350,000/mo', features: 'Up to 5 gates, full analytics, PDF reports' },
          { name: 'Intelligence', price: '₦650,000/mo', features: 'Unlimited gates, white-label, deep reports' },
        ].map(p => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <div>
              <div style={{ fontWeight: '700', marginBottom: '2px' }}>{p.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{p.features}</div>
            </div>
            <div style={{ fontWeight: '700', color: 'var(--accent)', flexShrink: 0 }}>{p.price}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-label" style={{ marginBottom: '8px' }}>Coming in Phase 2</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.8' }}>
          Paystack payment integration · Automated recurring billing · Plan enforcement · Staging environment · Scheduled email digests
        </div>
      </div>
    </div>
  )
}

// ── Loading helper ──
function LoadingState() {
  return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)', fontSize: '14px' }}>Loading...</div>
}

// ── Main AdminApp ──
export default function AdminApp() {
  const [authed, setAuthed] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (authed) {
      supabase.from('tenants').select('id', { count: 'exact' }).eq('is_active', false)
        .then(({ count }) => setPendingCount(count || 0))
    }
  }, [authed])

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'requests', label: 'Requests', badge: pendingCount },
    { key: 'tenants', label: 'Tenants' },
    { key: 'officers', label: 'Officers' },
    { key: 'incidents', label: 'Incidents' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0f1923 100%)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>
        <div>
          <div style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '800', letterSpacing: '0.06em', marginBottom: '2px' }}>SENTRi Superadmin</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '0.04em' }}>IGATA Technologies · Restricted Access</div>
        </div>
        <button onClick={() => setAuthed(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', padding: '7px 14px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '600', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>

      {/* Nav */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', gap: '2px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: '12px 16px', border: 'none', background: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-2)', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: activeTab === tab.key ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', transition: 'all 0.15s', marginBottom: '-1px' }}>
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ position: 'absolute', top: '6px', right: '4px', background: 'var(--amber)', color: 'white', borderRadius: '10px', fontSize: '10px', padding: '1px 5px', fontWeight: '700' }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto', overflowY: 'auto' }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'officers' && <OfficersTab />}
        {activeTab === 'incidents' && <AdminIncidentsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
`

// ── UPDATE Registration to create is_active: false ────────────────────────────
let login = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')
if (login.includes("is_active: true,\n        custom_destinations")) {
  login = login.replace(
    "is_active: true,\n        custom_destinations",
    "is_active: false,\n        custom_destinations"
  )
  console.log('✓ Registration: new tenants created as is_active: false')
} else if (login.includes('is_active: true')) {
  login = login.replace('is_active: true', 'is_active: false')
  console.log('✓ Registration: new tenants created as is_active: false (fallback)')
}

// Add pending screen after login check
const oldOnboardingCheck = `      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('onboarding_complete')
          .eq('id', result.tenantId)
          .single()
        if (tenantData && !tenantData.onboarding_complete) {
          navigate('/onboarding')
        } else {
          navigate('/command')
        }
      } catch (e) {
        navigate('/command')
      }`

const newOnboardingCheck = `      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('onboarding_complete, is_active')
          .eq('id', result.tenantId)
          .single()
        if (tenantData && !tenantData.is_active) {
          navigate('/pending')
        } else if (tenantData && !tenantData.onboarding_complete) {
          navigate('/onboarding')
        } else {
          navigate('/command')
        }
      } catch (e) {
        navigate('/command')
      }`

login = login.replace(oldOnboardingCheck, newOnboardingCheck)
fs.writeFileSync('src/pages/auth/CommandLogin.jsx', login, 'utf8')
console.log('✓ Login: redirects to /pending if account not yet activated')

// ── CREATE Pending Activation Page ───────────────────────────────────────────
const pendingPage = `import { useAuthStore } from '../../store'

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
`

fs.mkdirSync('src/pages/auth', { recursive: true })
fs.writeFileSync('src/pages/auth/PendingActivation.jsx', pendingPage, 'utf8')
console.log('✓ PendingActivation.jsx created')

// ── UPDATE App.jsx — add /pending route ───────────────────────────────────────
let app = fs.readFileSync('src/App.jsx', 'utf8')
if (!app.includes('PendingActivation')) {
  app = app.replace(
    "import OnboardingWizard from './pages/auth/OnboardingWizard'",
    "import OnboardingWizard from './pages/auth/OnboardingWizard'\nimport PendingActivation from './pages/auth/PendingActivation'"
  )
  app = app.replace(
    "        <Route path=\"/onboarding\" element={<OnboardingRoute />} />",
    "        <Route path=\"/onboarding\" element={<OnboardingRoute />} />\n        <Route path=\"/pending\" element={<PendingActivation />} />"
  )
  fs.writeFileSync('src/App.jsx', app, 'utf8')
  console.log('✓ App.jsx: /pending route added')
}

// ── WRITE AdminApp ────────────────────────────────────────────────────────────
fs.writeFileSync('src/pages/admin/AdminApp.jsx', adminApp, 'utf8')
console.log('✓ AdminApp.jsx — complete rebuild written')

// ── VERIFY ────────────────────────────────────────────────────────────────────
const adminContent = fs.readFileSync('src/pages/admin/AdminApp.jsx', 'utf8')
const loginContent = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')
const appContent = fs.readFileSync('src/App.jsx', 'utf8')

const checks = {
  'Admin: premium login screen': adminContent.includes('LoginScreen'),
  'Admin: overview with live feed': adminContent.includes('Live Feed'),
  'Admin: requests tab': adminContent.includes('RequestsTab'),
  'Admin: tenant profile drill-down': adminContent.includes('TenantProfile'),
  'Admin: activate sends email': adminContent.includes('Account Activated'),
  'Admin: plan management': adminContent.includes('PLANS'),
  'Admin: pending badge on nav': adminContent.includes('pendingCount'),
  'Admin: officers search': adminContent.includes('search.toLowerCase()'),
  'Admin: settings with pricing': adminContent.includes('₦150,000'),
  'Login: new tenants inactive': loginContent.includes('is_active: false'),
  'Login: redirects to /pending': loginContent.includes("navigate('/pending')"),
  'App: /pending route': appContent.includes('/pending'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Complete superadmin rebuild + approval-based registration flow"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nSuperadmin: sentri-igata.netlify.app/admin → IGATASentri@Admin2024')
console.log('New registrations now require your activation before access.')
