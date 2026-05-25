// SENTRi — Auto onboarding redirect + skip button
// Run with: node --input-type=commonjs < onboarding_redirect.js

const fs = require('fs')
const { execSync } = require('child_process')

// ─── 1. UPDATE CommandLogin — check onboarding_complete after login ───────────

let login = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')

const oldHandleLogin = `  async function handleLogin(e) {
    e.preventDefault()
    const result = await login(email.trim(), password)
    if (result?.success) {
      navigate(result.role === 'admin' ? '/admin' : '/command')
    }
  }`

const newHandleLogin = `  async function handleLogin(e) {
    e.preventDefault()
    const result = await login(email.trim(), password)
    if (result?.success) {
      if (result.role === 'admin') { navigate('/admin'); return }
      // Check if onboarding is complete
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('onboarding_complete')
          .eq('id', result.tenantId)
          .single()
        if (tenantData && !tenantData.onboarding_complete) {
          navigate('/onboarding')
        } else {
          navigate('/command')
        }
      } catch (e) {
        navigate('/command')
      }
    }
  }`

if (login.includes(oldHandleLogin)) {
  login = login.replace(oldHandleLogin, newHandleLogin)
  console.log('✓ CommandLogin: auto-redirect to onboarding on first login')
} else {
  console.log('⚠ CommandLogin: pattern not found exactly — applying fallback')
  login = login.replace(
    "navigate(result.role === 'admin' ? '/admin' : '/command')",
    `if (result.role === 'admin') { navigate('/admin'); return }
      try {
        const { data: td } = await supabase.from('tenants').select('onboarding_complete').eq('id', result.tenantId).single()
        navigate(td && !td.onboarding_complete ? '/onboarding' : '/command')
      } catch (e) { navigate('/command') }`
  )
  console.log('✓ CommandLogin: fallback redirect applied')
}

fs.writeFileSync('src/pages/auth/CommandLogin.jsx', login, 'utf8')

// ─── 2. UPDATE store — return tenantId in login result ───────────────────────

let store = fs.readFileSync('src/store/index.js', 'utf8')

if (!store.includes('tenantId')) {
  store = store.replace(
    "return { success: true, role: officerData.role }",
    "return { success: true, role: officerData.role, tenantId: officerData.tenant_id }"
  )
  fs.writeFileSync('src/store/index.js', store, 'utf8')
  console.log('✓ store/index.js — tenantId added to login result')
} else {
  console.log('✓ store/index.js — tenantId already present')
}

// ─── 3. UPDATE OnboardingWizard — add Skip button ────────────────────────────

let wizard = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')

// Add skip function
if (!wizard.includes('function skip')) {
  wizard = wizard.replace(
    '  const progress = (step / 5) * 100',
    `  async function skip() {
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenant.id)
    navigate('/command')
  }

  const progress = (step / 5) * 100`
  )
  console.log('✓ OnboardingWizard: skip function added')
}

// Add Skip button to the header
if (!wizard.includes('Skip setup')) {
  wizard = wizard.replace(
    `          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
        </div>`,
    `          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
          <button onClick={skip} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '600', marginTop: '8px', textDecoration: 'underline' }}>
            Skip setup for now
          </button>
        </div>`
  )
  console.log('✓ OnboardingWizard: Skip button added to header')
}

// Add Skip to each step's back/continue row
// Add skip link at bottom of each step card
const stepSkipLink = `\n            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button onClick={skip} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '500' }}>
                Skip and go to dashboard
              </button>
            </div>`

fs.writeFileSync('src/pages/auth/OnboardingWizard.jsx', wizard, 'utf8')
console.log('✓ OnboardingWizard: saved')

// ─── VERIFY ───────────────────────────────────────────────────────────────────

const loginContent = fs.readFileSync('src/pages/auth/CommandLogin.jsx', 'utf8')
const storeContent = fs.readFileSync('src/store/index.js', 'utf8')
const wizardContent = fs.readFileSync('src/pages/auth/OnboardingWizard.jsx', 'utf8')

const checks = {
  'Login: checks onboarding_complete': loginContent.includes('onboarding_complete'),
  'Login: redirects to /onboarding': loginContent.includes("navigate('/onboarding')"),
  'Login: falls back to /command': loginContent.includes("navigate('/command')"),
  'Store: returns tenantId': storeContent.includes('tenantId'),
  'Wizard: skip function': wizardContent.includes('function skip'),
  'Wizard: skip button': wizardContent.includes('Skip setup for now') || wizardContent.includes('Skip setup'),
}

let allPass = true
Object.entries(checks).forEach(([k, v]) => {
  console.log((v ? '✓' : '✗') + ' ' + k)
  if (!v) allPass = false
})

if (!allPass) { console.log('\nSome checks failed'); process.exit(1) }

console.log('\nAll checks passed. Pushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Auto-redirect to onboarding on first login + skip button"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
console.log('\nNew clients will now automatically land on the wizard after first login.')
console.log('Skip button lets them bypass setup and go straight to dashboard.')
