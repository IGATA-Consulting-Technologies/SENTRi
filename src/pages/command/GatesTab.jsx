import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const STREAM_TYPES = [
  { value: 'snapshot', label: 'Snapshot (HTTPS)', hint: 'URL returns a JPEG image — works from any network' },
  { value: 'mjpeg',    label: 'MJPEG Stream',    hint: 'Continuous MJPEG video stream over HTTP' },
  { value: 'hls',      label: 'HLS Stream',      hint: 'Cloud-based HLS stream — works from any network' },
  { value: 'rtsp',     label: 'RTSP Stream',      hint: 'Local RTSP stream — viewable only on local network' },
]

const TYPE_COLOR = { snapshot: 'var(--accent)', mjpeg: 'var(--green)', hls: '#8b5cf6', rtsp: '#f59e0b' }

function CameraSection({ gate, tenantId }) {
  const [cameras, setCameras] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', stream_type: 'snapshot' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (expanded) fetchCameras() }, [expanded])

  async function fetchCameras() {
    const { data } = await supabase.from('cameras').select('*')
      .eq('gate_id', gate.id).eq('is_active', true).order('created_at')
    setCameras(data || [])
  }

  async function addCamera() {
    if (!form.name.trim() || !form.url.trim()) { setError('Camera name and URL are required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('cameras').insert({
      tenant_id: tenantId, gate_id: gate.id,
      name: form.name.trim(), url: form.url.trim(),
      stream_type: form.stream_type, is_active: true
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ name: '', url: '', stream_type: 'snapshot' })
    setShowForm(false)
    fetchCameras()
  }

  async function removeCamera(id) {
    await supabase.from('cameras').update({ is_active: false }).eq('id', id)
    fetchCameras()
  }

  const selType = STREAM_TYPES.find(t => t.value === form.stream_type)

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
      <button onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}>
          CCTV Cameras
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-2)', marginLeft: '2px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '10px' }}>
          {cameras.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {cameras.map(cam => (
                <div key={cam.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-2)', borderRadius: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{cam.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.url}</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: (TYPE_COLOR[cam.stream_type] || 'var(--accent)') + '20', color: TYPE_COLOR[cam.stream_type] || 'var(--accent)', flexShrink: 0 }}>
                    {cam.stream_type.toUpperCase()}
                  </span>
                  <button onClick={() => removeCamera(cam.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: '1px dashed var(--border-med)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', width: '100%' }}>
              + Add camera
            </button>
          ) : (
            <div style={{ background: 'var(--bg-2)', borderRadius: '10px', padding: '14px', border: '1.5px solid var(--border-med)' }}>
              {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '10px' }}>{error}</div>}
              <div className="field">
                <label style={{ fontSize: '11px' }}>Camera name *</label>
                <input placeholder="e.g. Gate Entry Camera" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ fontSize: '13px', padding: '8px 10px' }} />
              </div>
              <div className="field">
                <label style={{ fontSize: '11px' }}>Stream type *</label>
                <select value={form.stream_type} onChange={e => setForm(f => ({ ...f, stream_type: e.target.value }))}
                  style={{ fontSize: '13px', padding: '8px 10px', width: '100%', border: '1.5px solid var(--border-med)', borderRadius: '8px', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}>
                  {STREAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {selType && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>{selType.hint}</div>}
              </div>
              <div className="field" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px' }}>Camera URL *</label>
                <input placeholder={form.stream_type === 'rtsp' ? 'rtsp://username:password@192.168.1.64:554/stream' : form.stream_type === 'mjpeg' ? 'http://camera-ip/video.mjpeg' : 'http://camera-ip/snapshot.jpg'} value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  style={{ fontSize: '12px', padding: '8px 10px', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addCamera} disabled={saving || !form.name.trim() || !form.url.trim()}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '700', cursor: 'pointer', opacity: saving || !form.name.trim() || !form.url.trim() ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save camera'}
                </button>
                <button onClick={() => { setShowForm(false); setError('') }}
                  style={{ background: 'none', border: '1px solid var(--border-med)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text-2)' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Gate Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Manage gates and CCTV cameras for each post.</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError('') }}
          style={{ background: showForm ? 'var(--bg-3)' : 'var(--accent)', color: showForm ? 'var(--text-2)' : 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
          {showForm ? 'Cancel' : '+ Add Gate'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-1)', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>New Gate</h3>
          {error && <div style={{ background: 'rgba(192,19,42,0.08)', border: '1px solid rgba(192,19,42,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--red)', marginBottom: '12px' }}>{error}</div>}
          <div className="field">
            <label>Gate name *</label>
            <input placeholder="e.g. Main Gate, North Gate" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
          Loading gates...
        </div>
      ) : gates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1.5px dashed var(--border-med)' }}>
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
              <CameraSection gate={gate} tenantId={tenant.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
