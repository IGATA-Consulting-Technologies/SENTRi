import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const SECTORS = [
  { value: 'military',   label: 'Military / Defence', icon: '🛡️' },
  { value: 'oil_gas',    label: 'Oil & Gas',           icon: '⚙️' },
  { value: 'banking',    label: 'Banking / Finance',   icon: '🏦' },
  { value: 'corporate',  label: 'Corporate',           icon: '🏢' },
  { value: 'government', label: 'Government',          icon: '🏛️' },
  { value: 'other',      label: 'Other',               icon: '🔒' },
]

const SECTOR_PROFILE = {
  military:   { idLabel: 'Service number', idPlaceholder: 'e.g. N/12345',   rankLabel: 'Rank',             rankPlaceholder: 'e.g. Colonel, Major',      showRank: true  },
  oil_gas:    { idLabel: 'Staff ID',       idPlaceholder: 'e.g. OG/00123',  rankLabel: 'Department',       rankPlaceholder: 'e.g. HSE, Operations',     showRank: false },
  banking:    { idLabel: 'Staff ID',       idPlaceholder: 'e.g. BK/00123',  rankLabel: 'Branch / Unit',    rankPlaceholder: 'e.g. Security, Operations',showRank: false },
  corporate:  { idLabel: 'Employee ID',    idPlaceholder: 'e.g. EMP/456',   rankLabel: 'Department',       rankPlaceholder: 'e.g. Facilities, Security',showRank: false },
  government: { idLabel: 'Staff ID',       idPlaceholder: 'e.g. GL07/1234', rankLabel: 'Ministry / Agency',rankPlaceholder: 'e.g. Ministry of Defence', showRank: false },
  other:      { idLabel: 'ID number',      idPlaceholder: 'Your ID number', rankLabel: 'Department',       rankPlaceholder: 'e.g. Security',            showRank: false },
}

const DEFAULT_DESTINATIONS = {
  military:   ['Administration Block','Officers Mess','Barracks / Quarters','Armoury','Medical Centre','Sports Complex','Provost Office','Signals Unit','Quartermaster Store','Commanding Officer Office'],
  oil_gas:    ['Control Room','Wellhead Area','Refinery Block','Admin Building','Warehouse','Maintenance Bay','HSE Office','Canteen','Medical Bay','Security Post'],
  banking:    ['Banking Hall','Vault Area','Executive Floor','IT Room','HR Office','Board Room','Customer Service','Back Office','ATM Room','Security Room'],
  corporate:  ['Reception','Executive Suite','Conference Room','IT Department','Finance','HR Department','Operations','Warehouse','Cafeteria','Server Room'],
  government: ['Registry','Executive Office','Conference Room','Finance Department','HR Office','IT Unit','Public Relations','Security Post','Archives','Board Room'],
  other:      ['Main Office','Reception','Meeting Room','Warehouse','Security Post','Management Office','Staff Area','Visitor Lounge'],
}

const DEFAULT_PURPOSES = {
  military:   ['Official visit','Delivery / Supply','Maintenance / Repair','Training','Personal visit','Medical','Contractor / Vendor'],
  oil_gas:    ['Official visit','Contractor / Vendor','HSE Inspection','Maintenance','Delivery','Emergency Response','Audit','Training'],
  banking:    ['Official visit','Audit','IT Support','Delivery','Meeting','Contractor','Regulatory Visit','Training'],
  corporate:  ['Official visit','Meeting','Delivery','Maintenance','Contractor','Interview','Training','Client Visit'],
  government: ['Official visit','Meeting','Delivery','Audit','Inspection','Contractor','Training','Personal visit'],
  other:      ['Official visit','Meeting','Delivery','Maintenance','Contractor','Personal visit','Training'],
}

export default function OnboardingWizard() {
  const { setTenantAndOfficer } = useAuthStore()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true) // guard check in progress
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auth user info
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  // Step 1
  const [installationName, setInstallationName] = useState('')
  const [sector, setSector] = useState('military')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')

  // Step 2
  const [officerName, setOfficerName] = useState('')
  const [rank, setRank] = useState('')
  const [serviceNumber, setServiceNumber] = useState('')

  // Created records
  const [tenantId, setTenantId] = useState(null)
  const [tenantSlug, setTenantSlug] = useState(null)

  // Step 3
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS['military'])
  const [newDest, setNewDest] = useState('')

  // Step 4
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES['military'])
  const [newPurpose, setNewPurpose] = useState('')

  // Step 5
  const [gates, setGates] = useState([{ name: '', location: '' }])
  const [createdGates, setCreatedGates] = useState([])
  const [copied, setCopied] = useState(null)

  // ── Guard: run on mount, check if wizard should be skipped ──
  useEffect(() => {
    async function guard() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login', { replace: true }); return }

      const uid = session.user.id
      setUserId(uid)
      setUserEmail(session.user.email)
      setUserName(session.user.user_metadata?.full_name || '')

      // Check if officer record exists
      const { data: officer } = await supabase
        .from('officers').select('*, tenants(*)').eq('id', uid).single()

      if (officer?.tenants?.onboarding_complete) {
        // Wizard already completed — go straight to command
        setTenantAndOfficer(officer.tenants, officer)
        navigate('/command', { replace: true })
        return
      }

      if (officer?.tenant_id) {
        // Officer exists but onboarding not complete — resume from correct step
        setTenantId(officer.tenant_id)
        setTenantSlug(officer.tenants?.slug || null)
        if (officer.tenants?.sector) {
          setSector(officer.tenants.sector)
          setDestinations(DEFAULT_DESTINATIONS[officer.tenants.sector] || DEFAULT_DESTINATIONS.other)
          setPurposes(DEFAULT_PURPOSES[officer.tenants.sector] || DEFAULT_PURPOSES.other)
        }
        setTenantAndOfficer(officer.tenants, officer)
        // Officer and tenant exist — skip to gates step
        setStep(5)
        setChecking(false)
        return
      }

      // Check if tenant exists without officer (step 1 completed but step 2 failed)
      // We can't query tenants by user easily — just start from step 1
      setChecking(false)
    }
    guard()
  }, [])

  function handleSectorChange(s) {
    setSector(s)
    setDestinations(DEFAULT_DESTINATIONS[s] || DEFAULT_DESTINATIONS.other)
    setPurposes(DEFAULT_PURPOSES[s] || DEFAULT_PURPOSES.other)
  }

  function err(msg) { setError(msg); setSaving(false) }

  // Step 1 — Create tenant
  async function saveStep1() {
    if (!installationName.trim()) { err('Installation name is required'); return }
    setSaving(true); setError('')
    const slug = installationName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error: e } = await supabase.from('tenants').insert({
      name: installationName.trim(), slug, sector,
      city: city.trim(), state: stateName.trim(),
      is_active: true, onboarding_complete: false,
      custom_destinations: [], custom_purposes: [],
    }).select().single()
    if (e) { err('Could not create installation: ' + e.message); return }
    setTenantId(data.id)
    setTenantSlug(slug)
    setSaving(false)
    setStep(2)
  }

  // Step 2 — Create officer
  async function saveStep2() {
    if (!officerName.trim()) { err('Your name is required'); return }
    const profile = SECTOR_PROFILE[sector] || SECTOR_PROFILE.other
    if (!serviceNumber.trim()) { err(profile.idLabel + ' is required'); return }
    setSaving(true); setError('')

    // Check if officer already exists (resume scenario)
    const { data: existing } = await supabase
      .from('officers').select('id').eq('id', userId).single()

    let officerData
    if (existing) {
      // Update existing officer rather than insert
      const { data, error: e } = await supabase
        .from('officers')
        .update({ name: officerName.trim(), rank: rank.trim() || null, service_number: serviceNumber.trim().toUpperCase(), tenant_id: tenantId })
        .eq('id', userId)
        .select('*, tenants(*)').single()
      if (e) { err('Could not update profile: ' + e.message); return }
      officerData = data
    } else {
      const { data, error: e } = await supabase.from('officers').insert({
        id: userId, name: officerName.trim(), rank: rank.trim() || null,
        email: userEmail, service_number: serviceNumber.trim().toUpperCase(),
        tenant_id: tenantId, role: 'command', is_active: true,
      }).select('*, tenants(*)').single()
      if (e) { err('Could not create profile: ' + e.message); return }
      officerData = data
    }

    setTenantAndOfficer(officerData.tenants, officerData)
    setSaving(false)
    setStep(3)
  }

  // Step 3 — Save destinations
  async function saveStep3() {
    if (destinations.length === 0) { err('Add at least one destination'); return }
    setSaving(true); setError('')
    await supabase.from('tenants').update({ custom_destinations: destinations }).eq('id', tenantId)
    setSaving(false); setStep(4)
  }

  // Step 4 — Save purposes
  async function saveStep4() {
    if (purposes.length === 0) { err('Add at least one purpose'); return }
    setSaving(true); setError('')
    await supabase.from('tenants').update({ custom_purposes: purposes }).eq('id', tenantId)
    setSaving(false); setStep(5)
  }

  // Step 5 — Create gates + mark complete
  async function saveStep5() {
    const validGates = gates.filter(g => g.name.trim())
    if (validGates.length === 0) { err('Add at least one gate'); return }
    setSaving(true); setError('')

    // Capture slug in local variable — state closure can be stale in loops
    const currentTenantSlug = tenantSlug
    const currentTenantId = tenantId
    const origin = window.location.origin

    const created = []
    for (const g of validGates) {
      const gSlug = g.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
        + '-' + Math.random().toString(36).slice(2, 6)
      const { data, error: gErr } = await supabase.from('gates').insert({
        tenant_id: currentTenantId,
        name: g.name.trim(),
        slug: gSlug,
        location: g.location.trim() || null,
        is_active: true,
      }).select().single()
      if (data) {
        const gateUrl = origin + '/gate/' + currentTenantSlug + '/' + gSlug
        created.push({ ...data, url: gateUrl })
        console.log('Gate created:', g.name.trim(), gateUrl)
      } else if (gErr) {
        console.error('Gate creation error for', g.name.trim(), ':', gErr.message)
      }
    }
    console.log('Total gates created:', created.length)
    setCreatedGates([...created])

    // Mark onboarding complete — with retry
    const { error: completeErr } = await supabase
      .from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    if (completeErr) {
      await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    }

    // Update auth store tenant
    const currentState = useAuthStore.getState()
    if (currentState.tenant) {
      currentState.setTenantAndOfficer(
        { ...currentState.tenant, onboarding_complete: true },
        currentState.officer
      )
    }

    // Fire notification email
    try {
      await fetch('/.netlify/functions/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ['igataprojects@gmail.com'],
          subject: 'New SENTRi Installation Ready — ' + installationName.trim(),
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#0a0f1e 0%,#1a56db 100%);padding:28px;">
                <div style="color:white;font-size:20px;font-weight:800;letter-spacing:0.08em;">SENTRi</div>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">New Installation Ready</div>
              </div>
              <div style="padding:28px;">
                <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a2e;">Setup complete</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;width:40%;">Installation</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">${installationName.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Sector</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">${sector}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Officer</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">${rank.trim() ? rank.trim() + ' ' : ''}${officerName.trim()}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">${userEmail}</td></tr>
                  <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;">Gates</td><td style="padding:8px 0;font-size:14px;">${created.length} gate(s) created</td></tr>
                </table>
                <a href="https://sentri-igata.netlify.app/admin" style="display:block;margin-top:24px;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View in Superadmin →</a>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #e2e6ed;font-size:11px;color:#9ca3af;">IGATA Technologies · SENTRi Platform</div>
            </div>
          </body></html>`
        })
      })
    } catch (e) { console.error('Notification email error:', e) }

    setSaving(false)
    setStep(6)
  }

  function copyUrl(gate) {
    navigator.clipboard.writeText(gate.url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const profile = SECTOR_PROFILE[sector] || SECTOR_PROFILE.other
  const stepLabels = ['Installation', 'Profile', 'Destinations', 'Purposes', 'Gates']

  // Show loading while guard check runs
  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '16px' }}>SENTRi</div>
        <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto' }} />
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '52px', height: '52px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(26,86,219,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Welcome to SENTRi</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
        </div>

        {step < 6 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              {stepLabels.map((label, i) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-3)', color: step >= i + 1 ? 'white' : 'var(--text-2)' }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '9px', color: step === i + 1 ? 'var(--accent)' : 'var(--text-2)', fontWeight: step === i + 1 ? '700' : '400', textAlign: 'center' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: ((step - 1) / 5 * 100) + '%', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* STEP 1 — Installation */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your installation</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Tell us about your facility.</p>
            <div className="field">
              <label>Installation name *</label>
              <input type="text" placeholder="e.g. Ikeja Cantonment, Shell SPDC Port Harcourt"
                value={installationName} onChange={e => { setInstallationName(e.target.value); setError('') }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Sector *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {SECTORS.map(s => (
                  <button key={s.value} onClick={() => { handleSectorChange(s.value); setError('') }}
                    style={{ padding: '12px', border: '2px solid', borderColor: sector === s.value ? 'var(--accent)' : 'var(--border-med)', borderRadius: 'var(--radius-md)', background: sector === s.value ? 'rgba(26,86,219,0.06)' : 'var(--bg-1)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{s.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: sector === s.value ? '700' : '500', color: sector === s.value ? 'var(--accent)' : 'var(--text-0)' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field-row" style={{ marginBottom: '10px' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>City</label>
                <input type="text" placeholder="e.g. Lagos" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>State</label>
                <input type="text" placeholder="e.g. Lagos State" value={stateName} onChange={e => setStateName(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: '8px' }} onClick={saveStep1} disabled={saving || !installationName.trim()}>
              {saving ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</> : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 2 — Profile */}
        {step === 2 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your profile</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Your command officer account for {installationName}.</p>
            <div className="field">
              <label>Full name *</label>
              <input type="text" placeholder="Your full name" value={officerName || userName}
                onChange={e => { setOfficerName(e.target.value); setError('') }} autoCapitalize="words" />
            </div>
            <div className="field">
              <label>{profile.rankLabel}</label>
              <input type="text" placeholder={profile.rankPlaceholder} value={rank} onChange={e => setRank(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: '24px' }}>
              <label>{profile.idLabel} *</label>
              <input type="text" placeholder={profile.idPlaceholder} value={serviceNumber}
                onChange={e => { setServiceNumber(e.target.value.toUpperCase()); setError('') }}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep2} disabled={saving || !serviceNumber.trim()}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Destinations */}
        {step === 3 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Destinations</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Locations visitors go to inside your facility. Pre-filled for your sector — edit freely.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{dest}</span>
                  <button onClick={() => setDestinations(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a destination..." value={newDest} onChange={e => setNewDest(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newDest.trim()) { setDestinations(prev => [...prev, newDest.trim()]); setNewDest('') } }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep3} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Purposes */}
        {step === 4 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Visit purposes</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Why do visitors come? Pre-filled for your sector — edit freely.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {purposes.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{p}</span>
                  <button onClick={() => setPurposes(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Add a visit purpose..." value={newPurpose} onChange={e => setNewPurpose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}
                style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }} />
              <button className="btn btn-outline" onClick={() => { if (newPurpose.trim()) { setPurposes(prev => [...prev, newPurpose.trim()]); setNewPurpose('') } }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep4} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Gates */}
        {step === 5 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your gates</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Add every gate or entry point. Each gets a unique URL — send to guards via WhatsApp.</p>
            {gates.map((gate, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate {i + 1}</span>
                  {gates.length > 1 && <button onClick={() => setGates(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                </div>
                <div className="field-row">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Gate name *</label>
                    <input type="text" placeholder="e.g. Main Gate" value={gate.name}
                      onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Location (optional)</label>
                    <input type="text" placeholder="e.g. North entrance" value={gate.location}
                      onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, location: e.target.value } : g))} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-full" style={{ marginBottom: '20px' }}
              onClick={() => setGates(prev => [...prev, { name: '', location: '' }])}>
              + Add another gate
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(4)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStep5}
                disabled={saving || !gates.some(g => g.name.trim())}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Setting up...</> : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6 — Done */}
        {step === 6 && (
          <div className="card fade-up" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 24px rgba(14,124,58,0.25)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
              {installationName} is live!
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: '1.6' }}>
              Your installation is fully set up. Copy your gate URLs below and send them to your guards via WhatsApp.
            </p>
            {createdGates.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Gate URLs</div>
                {createdGates.map(gate => (
                  <div key={gate.id} className="card" style={{ marginBottom: '10px', padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>{gate.name}</div>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginBottom: '10px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                      {gate.url}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => copyUrl(gate)}>
                      {copied === gate.id ? '✓ Copied!' : 'Copy URL'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/command', { replace: true })}>
              Go to command dashboard →
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '20px' }}>
          Powered by IGATA Technologies
        </p>
      </div>
    </div>
  )
}
