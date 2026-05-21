const fs = require('fs');
const { execSync } = require('child_process');

let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');

// Fix 1: Import useEffect
admit = admit.replace(
  "import { useState, useRef } from 'react'",
  "import { useState, useRef, useEffect } from 'react'"
);

// Fix 2: Add useEffect to attach stream after video renders
const afterRefs = `  const streamRef = useRef(null)

  // Attach stream to video element after it renders
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOpen])`;

admit = admit.replace(
  '  const streamRef = useRef(null)',
  afterRefs
);

// Fix 3: Update startCamera to set cameraOpen AFTER getting stream
const oldStartCamera = `  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOpen(true)
    } catch { alert('Camera access denied. Enter plate manually.') }
  }`;

const newStartCamera = `  async function startCamera() {
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
  }`;

if (admit.includes(oldStartCamera)) {
  admit = admit.replace(oldStartCamera, newStartCamera);
  console.log('startCamera fixed');
} else {
  console.log('startCamera pattern not found - check manually');
}

fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8');
console.log('AdmitPage.jsx camera fix applied');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix camera - use useEffect to attach stream after video renders"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
