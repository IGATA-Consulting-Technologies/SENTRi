const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Fix build failure (nodemailer removal)')
console.log('='.repeat(50))

const pkgPath = path.join(process.cwd(), 'package.json')

// Read
const raw = fs.readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(raw.replace(/^\uFEFF/, ''))

// Check
if (!pkg.dependencies?.nodemailer) {
  console.log('✗ nodemailer not found in dependencies — nothing to remove')
  process.exit(1)
}

// Remove
delete pkg.dependencies.nodemailer
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log('✓ Removed nodemailer from package.json')

// Verify
const updated = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
if (!updated.dependencies?.nodemailer) {
  console.log('✓ Verified: nodemailer no longer in dependencies')
} else {
  console.log('✗ Verification failed')
  process.exit(1)
}

// Git
try {
  execSync('git add package.json', { stdio: 'inherit' })
  execSync('git commit -m "Fix: remove nodemailer from frontend deps (caused Vite build failure)"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('')
console.log('Done. Check Netlify in ~60 seconds.')
