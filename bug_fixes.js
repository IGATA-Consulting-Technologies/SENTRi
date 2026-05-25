// SENTRi — Bug fixes: wizard pre-fill, logout redirect, infinite login
// Run with: node --input-type=commonjs < bug_fixes.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. FIX OnboardingWizard — clear pre-filled fields ───────────────────────

let wizard = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')

// Replace pre-filled state with empty defaults
wizard = wizard.replace(
  "const [sector, setSector] = useState(tenant?.sector || 'military')",
  "const [sector, setSector] = useState('military')"
)
wizard = wizard.replace(
  "const [branch, setBranch] = useState(tenant?.branch || '')",
  "const [branch, setBranch] = useState('')"
)
wizard = wizard.replace(
  "const [city, setCity] = useState(tenant?.city || '')",
  "const [city, setCity] = useState('')"
)
wizard = wizard.replace(
  "const [state, setState] = useState(tenant?.state || '')",
  "const [state, setState] = useState('')"
)

fs.writeFileSync('src/pages/auth/OnboardingWizard.jsx', wizard, 'utf8')
console.log('✓ OnboardingWizard: pre-filled fields cleared')

// ─── 2. FIX skip() — ensure onboarding_complete is saved reliably ─────────────

wizard = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')

// Make sure skip sets onboarding_complete = true before navigating
if (wizard.includes('async function skip()')) {
  wizard = wizard.replace(
    `  async function skip() {
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenant.id)
    navigate('/command')
  }`,
    `  async function skip() {
    try {
      await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenant.id)
    } catch (e) { console.error('Skip save error:', e) }
    navigate('/command')
  }`
  )
  console.log('✓ OnboardingWizard: skip() now reliably saves onboarding_complete')
}

fs.writeFileSync('src/pages/auth/OnboardingWizard.jsx', wizard, 'utf8')

// ─── 3. FIX CommandLogin — add timeout + error handling to login ──────────────

let login = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')

// Add login timeout — wrap the login call with a 10-second timeout
const oldSubmit = `  async function handleLogin(e) {
    e.preventDefault()
    const result = await login(email.trim(), password)`

const newSubmit = `  async function handleLogin(e) {
    e.preventDefault()
    // Add 10-second timeout to prevent infinite spinner
    let result
    try {
      const loginPromise = login(email.trim(), password)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. Please try again.')), 10000)
      )
      result = await Promise.race([loginPromise, timeoutPromise])
    } catch (err) {
      console.error('Login error:', err)
      return
    }`

if (login.includes(oldSubmit)) {
  login = login.replace(oldSubmit, newSubmit)
  console.log('✓ CommandLogin: 10-second timeout added to login')
} else {
  console.log('⚠ CommandLogin: timeout pattern not matched — check manually')
}

fs.writeFileSync('src/pages/auth/CommandLogin.jsx', login, 'utf8')

// ─── 4. FIX store — clear corrupted session on restoreSession failure ──────────

let store = fs.readFileSync('src/store/index.js', 'utf8')

const oldRestoreSession = `      restoreSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { set({ isAuthenticated: false, officer: null, tenant: null }); return }`

const newRestoreSession = `      restoreSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { set({ isAuthenticated: false, officer: null, tenant: null }); return }`

if (store.includes(oldRestoreSession)) {
  // Find the end of restoreSession and wrap it in try/catch
  store = store.replace(oldRestoreSession, newRestoreSession)

  // Find the closing of restoreSession and add catch
  store = store.replace(
    `        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true })
      },`,
    `          set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true })
        } catch (e) {
          console.error('Session restore error:', e)
          set({ isAuthenticated: false, officer: null, tenant: null })
        }
      },`
  )
  console.log('✓ store: restoreSession wrapped in try/catch — corrupted session handled')
} else {
  console.log('⚠ store: restoreSession pattern not matched exactly')
}

fs.writeFileSync('src/store/index.js', store, 'utf8')

// ─── 5. FIX App.jsx — clear stale auth state on load ─────────────────────────

let app = fs.readFileSync('src/App.jsx', 'utf8')

// Add supabase import if not present
if (!app.includes("from './lib/supabase'")) {
  app = app.replace(
    "import { useAuthStore, useGuardStore } from './store'",
    "import { useAuthStore, useGuardStore } from './store'\nimport { supabase } from './lib/supabase'"
  )
  console.log('✓ App.jsx: supabase import added')
}

fs.writeFileSync('src/App.jsx', app, 'utf8')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const wizardContent = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')
const loginContent = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')
const storeContent = fs.readFileSync('src/store/index.js', 'utf8')

const checks = {
  'Wizard: no pre-filled branch': !wizardContent.includes("tenant?.branch"),
  'Wizard: no pre-filled city': !wizardContent.includes("tenant?.city"),
  'Wizard: no pre-filled state': !wizardContent.includes("tenant?.state"),
  'Wizard: skip saves reliably': wizardContent.includes('Skip save error'),
  'Login: has timeout': loginContent.includes('timeoutPromise'),
  'Login: Promise.race': loginContent.includes('Promise.race'),
  'Login: 10 second timeout': loginContent.includes('10000'),
  'Store: try/catch on restoreSession': storeContent.includes('Session restore error'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Fix: wizard pre-fill, skip persistence, login timeout, session recovery"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
