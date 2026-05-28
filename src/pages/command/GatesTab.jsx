import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

export default function GatesTab() {
  const { tenant } = useAuthStore()
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)
  const [form, setForm] = useState({ name: '', location: '' })
  const [error, setError] = useState('')
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  useEffect(() => { fetchGates() }, [])

  async function fetchGates() {
    setLoading(true)
    const { data } = await supabase.from('gates').select('*')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: true })
    setGates(data || [])
    setLoading(false)
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)
  }

  async function createGate() {
    setError('')
    if (!form.name.trim()) { setError('Gate name is required'); return }
    const slug = slugify(form.name)
    setCreating(true)
    const { error: err } = await supabase.from('gates').insert({
      tenant_id: tenant.id, name: form.name.trim(), slug,
      location: form.location.trim() || null, is_active: true
    })
    setCreating(false)
    if (err) { setError(err.message); return }
    setForm({ name: '', location: '' })
    setShowForm(false)
    fetchGates()
  }

  async function toggleGate(gate) {
    await supabase.from('gates').update({ is_active: !gate.is_active }).eq('id', gate.id)
    fetchGates()
  }

  function copyUrl(gate) {
    const url = appUrl + '/gate/' + tenant.slug + '/' + gate.slug
    navigator.clipboard.writeText(url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: '680px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Gate Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Each gate has a unique URL. Send to guards via WhatsApp.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError('') }}
          style={{ background: showForm ? 'var(--bg-3)' : 'var(--accent)', color: showForm ? 'var(--text-2)' : 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
          {showForm ? 'Cancel' : '+ Add Gate'}
        </button>
      </div>

      {/* Add gate form */}
      {showForm && (
        <div style={{ background: 'var(--bg-1)', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>New Gate</h3>
          {error && <div style={{ background: 'rgba(192,19,42,0.08)', border: '1px solid rgba(192,19,42,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--red)', marginBottom: '12px' }}>{error}</div>}
          <div className="field">
            <label>Gate name *</label>
            <input placeholder="e.g. Main Gate, North Gate" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {form.name && (
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                URL preview: /gate/{tenant.slug}/{form.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-xxxx
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label>Location (optional)</label>
            <input placeholder="e.g. North perimeter, Maryland Road" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <button onClick={createGate} disabled={creating || !form.name.trim()}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 20px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating || !form.name.trim() ? 0.6 : 1 }}>
            {creating ? 'Creating...' : 'Create Gate'}
          </button>
        </div>
      )}

      {/* Gates list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
          Loading gates...
        </div>
      ) : gates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1.5px dashed var(--border-med)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.5" style={{ marginBottom: '12px' }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '16px' }}>No gates configured yet.</p>
          <button onClick={() => setShowForm(true)}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 20px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
            + Add your first gate
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {gates.map(gate => (
            <div key={gate.id} style={{ background: 'var(--bg-1)', border: '1.5px solid', borderColor: gate.is_active ? 'var(--border-med)' : 'var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', opacity: gate.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px' }}>{gate.name}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: gate.is_active ? 'rgba(14,124,58,0.1)' : 'var(--bg-3)', color: gate.is_active ? 'var(--green)' : 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {gate.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {gate.location && <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{gate.location}</div>}
                </div>
                <button onClick={() => toggleGate(gate)}
                  style={{ background: 'none', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '12px', color: gate.is_active ? 'var(--red)' : 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {gate.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '10px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                {appUrl}/gate/{tenant.slug}/{gate.slug}
              </div>
              <button onClick={() => copyUrl(gate)}
                style={{ background: copied === gate.id ? 'var(--green)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}>
                {copied === gate.id ? '✓ Copied!' : 'Copy URL'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
