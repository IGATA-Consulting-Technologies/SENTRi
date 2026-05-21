import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'
import { queueMovement } from '../../lib/offline'

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
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Attach stream to video element after it renders
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOpen])

  const effectiveGate = gate || gateData
  const effectiveTenant = tenant || tenantData

  function reset() {
    setType(null); setStep(0); setPlate(''); setOcrResult(null)
    setVisitorName(''); setIdNumber(''); setDestination(''); setPurpose('')
    setOccupants('1'); setNotes(''); setSubmitted(null); stopCamera()
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      setCameraOpen(true) // useEffect will attach stream after render
    } catch (err) {
      console.error('Camera error:', err)
      alert('Camera access denied. Please allow camera permissions and try again.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null; setCameraOpen(false)
  }

  async function captureOCR() {
    if (!videoRef.current || !canvasRef.current) return
    setScanning(true)
    const v = videoRef.current
    const c = canvasRef.current

    // Crop to plate region only — center 75% width, middle 35% height
    const srcW = v.videoWidth
    const srcH = v.videoHeight
    const cropW = Math.round(srcW * 0.75)
    const cropH = Math.round(srcH * 0.30)
    const cropX = Math.round((srcW - cropW) / 2)
    const cropY = Math.round((srcH - cropH) / 2)

    c.width = cropW
    c.height = cropH
    c.getContext('2d').drawImage(v, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data: { text, confidence } } = await Tesseract.recognize(c, 'eng', {
        logger: () => {},
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
      })
      // Extract plate-like patterns: 2-4 letters, space/dash, 3 digits, space/dash, 2 letters
      const cleaned = text.toUpperCase().replace(/[^A-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim()
      const plateMatch = cleaned.match(/[A-Z]{2,4}[-\s]?[0-9]{2,4}[-\s]?[A-Z]{2,3}/)
      const best = plateMatch ? plateMatch[0].replace(/\s+/g, ' ').trim() : cleaned.split(' ').filter(w => w.length >= 2).join(' ').trim()
      setOcrResult({ text: best, confidence: Math.round(confidence) })
      setPlate(best)
      stopCamera()
    } catch (e) {
      console.error('OCR error:', e)
    } finally {
      setScanning(false)
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
      destination, purpose,
      occupants: parseInt(occupants) || 1,
      notes: notes.trim() || null,
      entry_time: new Date().toISOString(),
      ocr_confidence: ocrResult?.confidence || null,
      synced: navigator.onLine
    }
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('movements').insert(movement).select().single()
        if (error) throw error
        setSubmitted(data || movement)
      } else {
        await queueMovement({ action: 'insert', data: movement })
        setSubmitted(movement)
      }
    } catch (e) {
      console.error('Submit error:', e)
      // Still show success — queue for later sync
      await queueMovement({ action: 'insert', data: { ...movement, synced: false } }).catch(() => {})
      setSubmitted(movement)
    } finally {
      setSubmitting(false)
      setStep(3) // Always navigate to success screen
    }
  }

  if (step === 3 && submitted) return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
      <div className="pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(14,124,58,0.3)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Admitted</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {!navigator.onLine ? 'Offline — will sync' : 'Logged'}
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
          { label: 'Officer', value: `${guard?.rank || ''} ${guard?.name || ''}`.trim() }
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

  return (
    <div className="page-content-padded">
      {step === 0 && (
        <div className="fade-up">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>New entry</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>What is entering the facility?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { value: 'vehicle', label: 'Vehicle', sub: 'Car, truck, motorcycle', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
              { value: 'pedestrian', label: 'Pedestrian', sub: 'Visitor on foot', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 4m3-4l3 4M9 21l3-4 3 4"/></svg> }
            ].map(opt => (
              <button key={opt.value} onClick={() => { setType(opt.value); setStep(1) }} style={{ background: 'var(--bg-1)', border: '2px solid var(--border-med)', borderRadius: 'var(--radius-lg)', padding: '20px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ marginBottom: '10px' }}>{opt.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', color: 'var(--text-0)' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="fade-up">
          <div className="steps">{[1,2].map(s => <div key={s} className={`step-bar ${s <= 1 ? 'active' : ''}`} />)}</div>
          <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>← Back</button>

          {type === 'vehicle' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>Plate number</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>Scan or enter the plate manually.</p>
              {!ocrResult && (
                <div style={{ background: '#000', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '14px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {cameraOpen
                    ? <>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ width: '78%', height: '60px', border: '2px solid #2563eb', borderRadius: '6px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)' }} />
                          <span style={{ color: 'white', fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>Align plate within frame</span>
                        </div>
                      </>
                    : <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-2)' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <div style={{ fontSize: '13px' }}>Tap to open camera</div>
                      </div>
                  }
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
                <input type="text" placeholder="e.g. LND 472 HG" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', letterSpacing: '0.08em' }} />
              </div>
              {!ocrResult && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  {!cameraOpen
                    ? <button className="btn btn-outline btn-full" onClick={startCamera}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Open camera
                      </button>
                    : <>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={captureOCR} disabled={scanning}>
                          {scanning ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Scanning...</> : 'Capture plate'}
                        </button>
                        <button className="btn btn-ghost" style={{ width: 'auto', padding: '10px 18px' }} onClick={stopCamera}>Cancel</button>
                      </>
                  }
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
            Continue →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="fade-up">
          <div className="steps">{[1,2].map(() => <div key={Math.random()} className="step-bar active" />)}</div>
          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>← Back</button>
          {plate && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: '500' }}>{plate}</div>}
          {type === 'vehicle' && <div className="field"><label>Visitor name (optional)</label><input type="text" placeholder="Driver / main visitor" value={visitorName} onChange={e => setVisitorName(e.target.value)} autoCapitalize="words" /></div>}
          <div className="field"><label>Destination *</label><select value={destination} onChange={e => setDestination(e.target.value)}><option value="">Select destination…</option>{DESTINATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
          <div className="field"><label>Purpose *</label><select value={purpose} onChange={e => setPurpose(e.target.value)}><option value="">Select purpose…</option>{PURPOSES.map(p => <option key={p}>{p}</option>)}</select></div>
          {type === 'vehicle' && <div className="field"><label>Occupants</label><input type="number" min="1" max="20" value={occupants} onChange={e => setOccupants(e.target.value)} /></div>}
          <div className="field"><label>Notes (optional)</label><input type="text" placeholder="Additional notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <button className="btn btn-success btn-full btn-lg" onClick={submit} disabled={!destination || !purpose || submitting}>
            {submitting ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Logging...</> : `✓ Admit ${type}`}
          </button>
        </div>
      )}
    </div>
  )
}
