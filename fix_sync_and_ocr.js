const fs = require('fs');
const { execSync } = require('child_process');

// Read current AdmitPage
let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');

// Fix 1: Replace isOnline from store with navigator.onLine
admit = admit.replace(
  'const { guard, gate, tenant, isOnline } = useGuardStore()',
  'const { guard, gate, tenant } = useGuardStore()'
);
admit = admit.replace('synced: isOnline', 'synced: navigator.onLine');
admit = admit.replace('if (isOnline) {', 'if (navigator.onLine) {');
admit = admit.replace(
  "{!isOnline ? 'Offline — will sync' : 'Logged'}",
  "{!navigator.onLine ? 'Offline — will sync' : 'Logged'}"
);

// Fix 2: Replace Tesseract OCR with PlateRecognizer API
const oldCaptureOCR = admit.match(/async function captureOCR\(\)[^}]+(?:\{(?:[^{}]|\{[^{}]*\})*\})+/s);
if (oldCaptureOCR) {
  const newCaptureOCR = `async function captureOCR() {
    if (!videoRef.current || !canvasRef.current) return
    setScanning(true)
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    try {
      // Convert canvas to blob
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.9))
      const formData = new FormData()
      formData.append('upload', blob, 'plate.jpg')
      formData.append('regions', 'ng') // Nigeria
      const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
        method: 'POST',
        headers: { 'Authorization': 'Token cd023a0e31de97d28995b3849851088c23403542' },
        body: formData
      })
      const data = await response.json()
      if (data.results && data.results.length > 0) {
        const best = data.results[0]
        const plateText = best.plate.text.toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim()
        const confidence = Math.round((best.score || 0) * 100)
        setOcrResult({ text: plateText, confidence })
        setPlate(plateText)
        stopCamera()
      } else {
        // No plate detected - keep camera open, show message
        alert('No plate detected. Reposition and try again, or enter manually.')
      }
    } catch (e) {
      console.error('PlateRecognizer error:', e)
      alert('Scan failed. Please enter plate manually.')
    } finally {
      setScanning(false)
    }
  }`;
  admit = admit.replace(oldCaptureOCR[0], newCaptureOCR);
  console.log('PlateRecognizer OCR integrated');
} else {
  console.log('captureOCR function not found - check manually');
}

fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8');

// Verify
const updated = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');
console.log('navigator.onLine occurrences:', (updated.match(/navigator\.onLine/g) || []).length);
console.log('PlateRecognizer API present:', updated.includes('platerecognizer.com'));
console.log('Tesseract still present:', updated.includes('tesseract'));

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix sync with navigator.onLine + integrate PlateRecognizer API"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
