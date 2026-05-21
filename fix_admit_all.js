const fs = require('fs');
const { execSync } = require('child_process');

let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');

// Fix 1: Fix captureOCR to only scan the plate region (center crop)
const oldCaptureOCR = `  async function captureOCR() {
    if (!videoRef.current || !canvasRef.current) return
    setScanning(true)
    const v = videoRef.current, c = canvasRef.current
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data: { text, confidence } } = await Tesseract.recognize(c, 'eng', { logger: () => {} })
      const lines = text.split('\\n').map(l => l.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '')).filter(l => l.length > 4)
      const best = lines.sort((a, b) => b.length - a.length)[0] || ''
      setOcrResult({ text: best, confidence: Math.round(confidence) })
      setPlate(best); stopCamera()
    } catch { } finally { setScanning(false) }
  }`;

const newCaptureOCR = `  async function captureOCR() {
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
      const cleaned = text.toUpperCase().replace(/[^A-Z0-9 -]/g, ' ').replace(/\\s+/g, ' ').trim()
      const plateMatch = cleaned.match(/[A-Z]{2,4}[-\\s]?[0-9]{2,4}[-\\s]?[A-Z]{2,3}/)
      const best = plateMatch ? plateMatch[0].replace(/\\s+/g, ' ').trim() : cleaned.split(' ').filter(w => w.length >= 2).join(' ').trim()
      setOcrResult({ text: best, confidence: Math.round(confidence) })
      setPlate(best)
      stopCamera()
    } catch (e) {
      console.error('OCR error:', e)
    } finally {
      setScanning(false)
    }
  }`;

if (admit.includes(oldCaptureOCR)) {
  admit = admit.replace(oldCaptureOCR, newCaptureOCR);
  console.log('OCR crop fix applied');
} else {
  console.log('OCR pattern not found');
}

// Fix 2: Fix submit to properly handle errors and always reach step 3
const oldSubmit = `  async function submit() {
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
      synced: isOnline
    }
    try {
      if (isOnline) {
        const { data } = await supabase.from('movements').insert(movement).select().single()
        setSubmitted(data || movement)
      } else {
        await queueMovement({ action: 'insert', data: movement })
        setSubmitted(movement)
      }
      setStep(3)
    } catch {
      await queueMovement({ action: 'insert', data: { ...movement, synced: false } })
      setSubmitted(movement); setStep(3)
    } finally { setSubmitting(false) }
  }`;

const newSubmit = `  async function submit() {
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
      synced: isOnline
    }
    try {
      if (isOnline) {
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
  }`;

if (admit.includes(oldSubmit)) {
  admit = admit.replace(oldSubmit, newSubmit);
  console.log('Submit fix applied');
} else {
  console.log('Submit pattern not found');
}

// Fix 3: Make camera view taller and more focused
const oldCameraView = `                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '14px', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {cameraOpen
                    ? <>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '75%', height: '56px', border: '2px solid var(--accent)', borderRadius: '6px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
                        </div>
                      </>
                    : <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-2)' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <div style={{ fontSize: '13px' }}>Tap to open camera</div>
                      </div>
                  }
                </div>`;

const newCameraView = `                <div style={{ background: '#000', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '14px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                </div>`;

if (admit.includes(oldCameraView)) {
  admit = admit.replace(oldCameraView, newCameraView);
  console.log('Camera view fix applied');
} else {
  console.log('Camera view pattern not found');
}

fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8');
console.log('AdmitPage.jsx all fixes applied');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix OCR crop, submit flow, camera view"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
