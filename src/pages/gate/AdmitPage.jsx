import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import { queueMovement, cacheAdmittedMovement } from '../../lib/offline'
import { sendFlagAlertEmail } from '../../lib/email'

const DESTINATIONS = ['Administration Block', 'Officers Mess', 'Barracks / Quarters', 'Armoury', 'Medical Centre', 'Sports Complex', 'Provost Office', 'Signals Unit', 'Quartermaster Store', 'Commanding Officer Office', 'Other']
const PURPOSES = ['Official visit', 'Delivery / Supply', 'Maintenance / Repair', 'Training', 'Personal visit', 'Medical', 'Contractor / Vendor', 'Other']
export default function AdmitPage({ gateData, tenantData }) {
  const { guard, gate, tenant } = useGuardStore()
  const [type, setType] = useState(null)
  const [step, setStep] = useState(0)
  const [plate, setPlate] = useState('')
  const [ocrResult, setOcrResult] = useState(null)
  const [visitorName, setVisitorName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [destination, setDestination] = useState('')
  const [purpose, setPurpose] = useState('')
  const [occupants, setOccupants] = useState('1')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cameraTorch, setCameraTorch] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const effectiveGate = gate || gateData
  const effectiveTenant = tenant || tenantData

  // Load tenant custom destinations and purposes
  // Read directly from store tenant (already freshly loaded from DB by GateApp)
  const [tenantDestinations, setTenantDestinations] = useState(null)
  const [tenantPurposes, setTenantPurposes] = useState(null)

  useEffect(() => {
    async function loadConfig(tenantId) {
      const { data } = await supabase
        .from('tenants')
        .select('custom_destinations, custom_purposes')
        .eq('id', tenantId)
        .single()
      if (data?.custom_destinations?.length > 0) setTenantDestinations(data.custom_destinations)
      if (data?.custom_purposes?.length > 0) setTenantPurposes(data.custom_purposes)
    }

    // Get tenant ID — try store first, then prop
    const tid = useGuardStore.getState().tenant?.id || tenantData?.id
    if (tid) {
      loadConfig(tid)
      return
    }

    // Tenant not yet in store — poll for it (handles slow load)
    const interval = setInterval(() => {
      const t = useGuardStore.getState().tenant
      if (t?.id) {
        clearInterval(interval)
        loadConfig(t.id)
      }
    }, 150)
    const timeout = setTimeout(() => clearInterval(interval), 8000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [effectiveTenant?.id, tenant?.id])

  const activeDestinations = tenantDestinations || DESTINATIONS
  const activePurposes = tenantPurposes || PURPOSES


  // Attach camera stream after video element renders
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOpen])

  function reset() {
    setType(null); setStep(0); setPlate(''); setOcrResult(null)
    setVisitorName(''); setIdNumber(''); setDestination(''); setPurpose('')
    setOccupants('1'); setNotes(''); setSubmitted(null); stopCamera()
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch (err) {
      console.error('Camera error:', err)
      alert('Camera access denied. Please allow camera permissions and enter plate manually.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
    setCameraTorch(false)
  }

  async function toggleCameraTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      const next = !cameraTorch
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setCameraTorch(next)
    } catch(e) { /* silent */ }
  }

  async function captureOCR() {
    if (!videoRef.current || !canvasRef.current) return
    setScanning(true)
    const v = videoRef.current
    const c = canvasRef.current

    // Send full frame to PlateRecognizer — it finds the plate itself
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)

    try {
      // Convert canvas to base64 and send to our serverless proxy
      const base64 = c.toDataURL('image/jpeg', 0.95).split(',')[1]

      const response = await fetch('/.netlify/functions/plate-recognizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })

      if (!response.ok) {
        throw new Error('API error: ' + response.status)
      }

      const data = await response.json()
      console.log('PlateRecognizer response:', JSON.stringify(data))

      if (data.results && data.results.length > 0) {
        const best = data.results[0]
        const plateText = (best.plate || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim()
        const confidence = Math.round((best.score || 0) * 100)
        setOcrResult({ text: plateText, confidence })
        setPlate(plateText)
        stopCamera()
      } else {
        alert('No plate detected. Reposition closer and try again, or enter manually.')
      }
    } catch (e) {
      console.error('PlateRecognizer error:', e)
      alert('Scan failed. Please enter plate manually.')
    } finally {
      setScanning(false)
    }
  }


  // Send email alert if entry was flagged
  async function checkAndAlertIfFlagged(movementId) {
    try {
      const { data: movement } = await supabase
        .from('movements')
        .select('flag_triggered, plate_number, visitor_name, destination, purpose')
        .eq('id', movementId)
        .single()

      if (movement?.flag_triggered) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('name, report_emails')
          .eq('id', effectiveTenant.id)
          .single()

        if (tenantData?.report_emails?.length > 0) {
          await sendFlagAlertEmail({
            tenantName: tenantData.name,
            gateName: effectiveGate?.name || 'Unknown Gate',
            plate: movement.plate_number,
            visitorName: movement.visitor_name,
            destination: movement.destination,
            purpose: movement.purpose,
            reportEmails: tenantData.report_emails
          })
        }
      }
    } catch (e) {
      console.error('Flag check error:', e)
    }
  }

  
// Capture gate camera snapshot at time of admission
async function captureSnapshot(gateId, movementId) {
  if (!gateId || !movementId) return
  try {
    const { data: cams } = await supabase
      .from('cameras')
      .select('id,url,stream_type')
      .eq('gate_id', gateId)
      .eq('is_active', true)
      .in('stream_type', ['snapshot'])  // only snapshot type works for capture
    if (!cams || cams.length === 0) return
    // For each snapshot camera, fetch the image and store the URL + timestamp
    const snapUrl = cams[0].url + (cams[0].url.includes('?') ? '&' : '?') + '_t=' + Date.now()
    await supabase.from('movements').update({
      snapshot_url: snapUrl,
      snapshot_camera_id: cams[0].id
    }).eq('id', movementId)
  } catch (e) {
    console.error('Snapshot capture error:', e)
    // Non-blocking — never disrupts the guard flow
  }
}

async function submit() {
    if (!destination || !purpose) return
    setSubmitting(true)
    const movement = {
      tenant_id: effectiveTenant?.id,
      gate_id: effectiveGate?.id,
      type,
      plate_number: type === 'vehicle' ? plate.toUpperCase().trim() || null : null,
      visitor_name: visitorName.trim() || null,
      id_number: idNumber.trim() || null,
      destination,
      purpose,
      occupants: parseInt(occupants) || 1,
      notes: notes.trim() || null,
      entry_time: new Date().toISOString(),
      ocr_confidence: ocrResult?.confidence || null,
      entry_officer_id: guard?.officerId || null,
      officer_name: [guard?.rank, guard?.name].filter(Boolean).join(' ') || null,
      synced: navigator.onLine
    }
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('movements').insert(movement).select().single()
        if (error) throw error
        setSubmitted(data || movement)
        cacheAdmittedMovement(data || movement).catch(() => {})
        if (data?.id) {
        checkAndAlertIfFlagged(data.id)
        captureSnapshot(effectiveGate?.id, data.id)
      }
      } else {
        await queueMovement({ action: 'insert', data: movement })
        setSubmitted(movement)
      }
    } catch (e) {
      console.error('Submit error:', e)
      await queueMovement({ action: 'insert', data: { ...movement, synced: false } }).catch(() => {})
      setSubmitted(movement)
    } finally {
      setSubmitting(false)
      setStep(3)
    }
  }

  // ── Success screen ──────────────────────────────────────────
  if (step === 3 && submitted) return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(14,124,58,0.3)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Admitted</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} &middot; {!navigator.onLine ? 'Offline — will sync' : 'Logged'}
      </p>
      {submitted.plate_number && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', letterSpacing: '0.12em', marginBottom: '16px', background: 'var(--bg-3)', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-med)' }}>
          {submitted.plate_number}
        </div>
      )}
      <div className="card" style={{ width: '100%', maxWidth: '360px', marginBottom: '20px' }}>
        {[
          { label: 'Visitor', value: submitted.visitor_name || '—' },
          { label: 'Destination', value: submitted.destination },
          { label: 'Purpose', value: submitted.purpose },
          { label: 'Officer', value: (guard?.rank || '') + ' ' + (guard?.name || '') }
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
            <span style={{ fontWeight: '500' }}>{r.value}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-full btn-lg" style={{ maxWidth: '360px' }} onClick={reset}>+ New entry</button>
    </div>
  )

  // ── Main flow ───────────────────────────────────────────────
  return (
    <div className="page-content-padded">

      {/* Step 0: Choose type */}
      {step === 0 && (
        <div className="fade-up">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>New entry</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>What is entering the facility?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { value: 'vehicle', label: 'Vehicle', sub: 'Car, truck, motorcycle',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
              { value: 'pedestrian', label: 'Pedestrian', sub: 'Visitor on foot',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 4m3-4l3 4M9 21l3-4 3 4"/></svg> }
            ].map(opt => (
              <button key={opt.value} onClick={() => { setType(opt.value); setStep(1) }}
                style={{ background: 'var(--bg-1)', border: '2px solid var(--border-med)', borderRadius: 'var(--radius-lg)', padding: '20px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ marginBottom: '10px' }}>{opt.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', color: 'var(--text-0)' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Plate / visitor details */}
      {step === 1 && (
        <div className="fade-up">
          <div className="steps">{[1,2].map(s => <div key={s} className={'step-bar' + (s <= 1 ? ' active' : '')} />)}</div>
          <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>&#8592; Back</button>

          {type === 'vehicle' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>Plate number</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>Point camera at plate and tap Capture.</p>

              {!ocrResult && (
                <div style={{ background: '#000', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '14px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {cameraOpen ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <div style={{ width: '78%', height: '64px', border: '2px solid #2563eb', borderRadius: '6px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)' }} />
                        <span style={{ color: 'white', fontSize: '11px', marginTop: '8px', opacity: 0.85 }}>Align plate within frame</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-2)' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <div style={{ fontSize: '13px' }}>Tap to open camera</div>
                    </div>
                  )}
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {ocrResult && (
                <div style={{ background: 'var(--green-dim)', border: '1.5px solid rgba(14,124,58,0.25)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Detected plate</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: ocrResult.confidence > 70 ? 'var(--green)' : 'var(--amber)' }}>{ocrResult.confidence}% confidence</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.12em', marginBottom: '8px' }}>{plate}</div>
                  {ocrResult.confidence < 70 && <div className="alert alert-warn" style={{ marginBottom: '8px', fontSize: '12px' }}>Low confidence — verify plate carefully.</div>}
                  <button onClick={() => { setOcrResult(null); setPlate('') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '600' }}>Rescan</button>
                </div>
              )}

              <div className="field">
                <label>{ocrResult ? 'Edit if needed' : 'Plate number'}</label>
                <input type="text" placeholder="e.g. LND 472 HG" value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', letterSpacing: '0.08em' }} />
              </div>

              {!ocrResult && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  {!cameraOpen ? (
                    <button className="btn btn-outline btn-full" onClick={startCamera}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Open camera
                    </button>
                  ) : (
                    <>
                      <button
                          onClick={toggleCameraTorch}
                          title={cameraTorch ? 'Torch off' : 'Torch on'}
                          style={{
                            background: cameraTorch ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.08)',
                            border: '1.5px solid ' + (cameraTorch ? '#facc15' : 'rgba(255,255,255,0.2)'),
                            borderRadius: '10px', width: '46px', height: '46px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, padding: 0
                          }}>
                          <svg width="18" height="18" viewBox="0 0 24 24"
                            fill={cameraTorch ? '#facc15' : 'none'}
                            stroke={cameraTorch ? '#facc15' : 'rgba(255,255,255,0.7)'}
                            strokeWidth="2" strokeLinecap="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                        </button>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={captureOCR} disabled={scanning}>
                        {scanning ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Scanning...</> : 'Capture plate'}
                      </button>
                      <button className="btn btn-ghost" style={{ width: 'auto', padding: '10px 18px' }} onClick={stopCamera}>Cancel</button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {type === 'pedestrian' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>Visitor details</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>Enter visitor name and ID.</p>
              <div className="field"><label>Full name *</label><input type="text" placeholder="Visitor's full name" value={visitorName} onChange={e => setVisitorName(e.target.value)} autoCapitalize="words" /></div>
              <div className="field"><label>ID number (NIN / Staff ID)</label><input type="text" placeholder="Optional" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} /></div>
            </>
          )}

          <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(2)}
            disabled={type === 'vehicle' ? plate.trim().length < 4 : !visitorName.trim()}>
            Continue &#8594;
          </button>
        </div>
      )}

      {/* Step 2: Destination and purpose */}
      {step === 2 && (
        <div className="fade-up">
          <div className="steps">{[1,2].map((s,i) => <div key={i} className="step-bar active" />)}</div>
          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>&#8592; Back</button>
          {plate && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: '500' }}>{plate}</div>}
          {type === 'vehicle' && <div className="field"><label>Visitor name (optional)</label><input type="text" placeholder="Driver / main visitor" value={visitorName} onChange={e => setVisitorName(e.target.value)} autoCapitalize="words" /></div>}
          <div className="field">
            <label>Destination *</label>
            <select value={destination} onChange={e => setDestination(e.target.value)}>
              <option value="">Select destination…</option>
              {activeDestinations.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Purpose *</label>
            <select value={purpose} onChange={e => setPurpose(e.target.value)}>
              <option value="">Select purpose…</option>
              {activePurposes.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          {type === 'vehicle' && <div className="field"><label>Occupants</label><input type="number" min="1" max="20" value={occupants} onChange={e => setOccupants(e.target.value)} /></div>}
          <div className="field"><label>Notes (optional)</label><input type="text" placeholder="Additional notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <button className="btn btn-full btn-lg" style={{ background: 'var(--green)', color: 'white', border: 'none' }} onClick={submit} disabled={!destination || !purpose || submitting}>
            {submitting ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Logging...</> : '✓ Admit ' + type}
          </button>
        </div>
      )}
    </div>
  )
}
