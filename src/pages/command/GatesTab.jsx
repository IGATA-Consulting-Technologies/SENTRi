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
    const { data } = await supabase.from('gates').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true })
    setGates(data || [])
    setLoading(false)
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
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
    navigator.clipboard.writeText(`${appUrl}/gate/${tenant.slug}/${gate.slug}`)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="gates-tab">
      <div className="tab-header">
        <div>
          <h2>Gate Management</h2>
          <p className="tab-sub">Each gate has a unique URL. Send it to the guard device to install as a PWA.</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setError('') }}>
          {showForm ? 'Cancel' : '+ Add Gate'}
        </button>
      </div>
      {showForm && (
        <div className="card form-card">
          <h3>Create New Gate</h3>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Gate Name *</label>
              <input placeholder="e.g. Maryland Gate, Main Gate" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {form.name && <span className="slug-preview">URL: /gate/{tenant.slug}/{slugify(form.name)}</span>}
            </div>
            <div className="form-group">
              <label>Location (optional)</label>
              <input placeholder="e.g. North perimeter, Maryland Road" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" onClick={createGate} disabled={creating}>{creating ? 'Creating...' : 'Create Gate'}</button>
        </div>
      )}
      {loading ? <div className="loading-state">Loading gates...</div> : gates.length === 0 ? (
        <div className="empty-state"><p>No gates configured yet. Add your first gate above.</p></div>
      ) : (
        <div className="gates-list">
          {gates.map(gate => (
            <div key={gate.id} className={`gate-card ${!gate.is_active ? 'gate-inactive' : ''}`}>
              <div className="gate-info">
                <div className="gate-name-row">
                  <span className="gate-name">{gate.name}</span>
                  <span className={`badge ${gate.is_active ? 'badge-green' : 'badge-grey'}`}>{gate.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                {gate.location && <span className="gate-location">{gate.location}</span>}
                <div className="gate-url-row">
                  <code className="gate-url">{appUrl}/gate/{tenant.slug}/{gate.slug}</code>
                </div>
              </div>
              <div className="gate-actions">
                <button className={`btn-copy ${copied === gate.id ? 'copied' : ''}`} onClick={() => copyUrl(gate)}>{copied === gate.id ? 'Copied!' : 'Copy URL'}</button>
                <button className="btn-ghost" onClick={() => toggleGate(gate)}>{gate.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
