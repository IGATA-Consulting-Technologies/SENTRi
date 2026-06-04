import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const TYPE_LABELS = {
  snapshot: { label: 'Snapshot', color: 'var(--accent)', desc: 'HTTPS snapshot URL' },
  mjpeg:    { label: 'MJPEG',    color: 'var(--green)',  desc: 'MJPEG stream URL' },
  rtsp:     { label: 'RTSP',     color: '#f59e0b',       desc: 'RTSP stream (local only)' },
  hls:      { label: 'HLS',      color: '#8b5cf6',       desc: 'HLS cloud stream URL' },
}

// Snapshot tile — refreshes every 3 seconds
function SnapshotTile({ camera, gateNme }) {
  const [src, setSrc] = useState(null)
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ts, setTs] = useState(Date.now())

  useEffect(() => {
    const iv = setInterval(() => setTs(Date.now()), 3000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    setLoading(true)
    setErr(false)
    const url = camera.url + (camera.url.includes('?') ? '&' : '?') + '_t=' + ts
    const img = new Image()
    img.onload = () => { setSrc(url); setLoading(false) }
    img.onerror = () => { setErr(true); setLoading(false) }
    img.src = url
  }, [ts])

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      {src && !err && <img src={src} alt={camera.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {loading && !src && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Connecting...</span>
        </div>
      )}
      {err && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>Camera unavailable</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', textAlign: 'center', wordBreak: 'break-all' }}>{camera.url}</span>
        </div>
      )}
    </div>
  )
}

// MJPEG tile — direct img src stream
function MjpegTile({ camera }) {
  const [err, setErr] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      {!err ? (
        <img src={camera.url} alt={camera.name}
          onError={() => setErr(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>Stream unavailable</span>
        </div>
      )}
    </div>
  )
}

// HLS tile — HTML5 video element
function HlsTile({ camera }) {
  const [err, setErr] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      {!err ? (
        <video src={camera.url} autoPlay muted playsInline
          onError={() => setErr(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>Stream unavailable</span>
        </div>
      )}
    </div>
  )
}

// RTSP tile — cannot play in browser, show info
function RtspTile({ camera }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#0a0a0a', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '20px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textAlign: 'center', lineHeight: '1.5' }}>
          RTSP streams require the facility's<br/>local CCTV software to view
        </span>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 12px', width: '100%' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stream URL</div>
          <div style={{ color: '#f59e0b', fontSize: '11px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{camera.url}</div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(camera.url); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: copied ? '#16a34a' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '7px 14px', color: 'white', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
          {copied ? '✓ Copied' : 'Copy URL'}
        </button>
      </div>
    </div>
  )
}

function CameraFeed({ camera, gateName }) {
  const type = TYPE_LABELS[camera.stream_type] || TYPE_LABELS.snapshot
  return (
    <div style={{ background: 'var(--bg-1)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '13px' }}>{camera.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '1px' }}>{gateName}</div>
        </div>
        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: type.color + '20', color: type.color, fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          {type.label}
        </span>
      </div>
      <div style={{ padding: '10px' }}>
        {camera.stream_type === 'snapshot' && <SnapshotTile camera={camera} gateName={gateName} />}
        {camera.stream_type === 'mjpeg'    && <MjpegTile camera={camera} />}
        {camera.stream_type === 'hls'      && <HlsTile camera={camera} />}
        {camera.stream_type === 'rtsp'     && <RtspTile camera={camera} />}
      </div>
    </div>
  )
}

export default function CCTVTab() {
  const { tenant } = useAuthStore()
  const [cameras, setCameras] = useState([])
  const [gates, setGates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: gateData }, { data: camData }] = await Promise.all([
      supabase.from('gates').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('cameras').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at'),
    ])
    setGates(gateData || [])
    setCameras(camData || [])
    setLoading(false)
  }

  const gateMap = {}
  gates.forEach(g => { gateMap[g.id] = g.name })
  const byCam = cameras.reduce((acc, c) => {
    const gn = gateMap[c.gate_id] || 'Unknown Gate'
    if (!acc[gn]) acc[gn] = []
    acc[gn].push(c)
    return acc
  }, {})

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-2)' }}>
      <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
      Loading cameras...
    </div>
  )

  if (cameras.length === 0) return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.2" style={{ marginBottom: '16px' }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>No cameras configured</p>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', maxWidth: '380px', margin: '0 auto 20px' }}>
        Add camera URLs in the Gates tab to enable live monitoring and admission snapshots.
      </p>
      <div style={{ background: 'var(--bg-1)', borderRadius: '10px', padding: '16px', maxWidth: '440px', margin: '0 auto', textAlign: 'left' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Supported stream types</div>
        {Object.entries(TYPE_LABELS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: val.color + '20', color: val.color, fontFamily: 'var(--font-display)', minWidth: '56px', textAlign: 'center' }}>{val.label}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{val.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '3px' }}>CCTV Monitoring</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{cameras.length} camera{cameras.length !== 1 ? 's' : ''} across {Object.keys(byCam).length} gate{Object.keys(byCam).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} style={{ background: 'var(--bg-1)', border: '1.5px solid var(--border-med)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600', cursor: 'pointer', color: 'var(--text-1)' }}>
          ↻ Refresh all
        </button>
      </div>

      {Object.entries(byCam).map(([gateName, cams]) => (
        <div key={gateName} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', color: 'var(--text-1)' }}>{gateName}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{cams.length} camera{cams.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {cams.map(cam => <CameraFeed key={cam.id} camera={cam} gateName={gateName} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
