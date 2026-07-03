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
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auth user
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  // ── All wizard data collected in React state ──
  // Step 1 — Installation
  const [installationName, setInstallationName] = useState('')
  const [sector, setSector] = useState('military')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')

  // Step 2 — Officer profile
  const [officerName, setOfficerName] = useState('')
  const [rank, setRank] = useState('')
  const [serviceNumber, setServiceNumber] = useState('')

  // Step 3 — Destinations
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS['military'])
  const [newDest, setNewDest] = useState('')

  // Step 4 — Purposes
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES['military'])
  const [newPurpose, setNewPurpose] = useState('')

  // Step 5 — Gates
  const [gates, setGates] = useState([{ name: '', location: '' }])

  // Step 6 — Created results
  const [createdGates, setCreatedGates] = useState([])
  const [copied, setCopied] = useState(null)

  // ── Guard: check if wizard already done ──
  useEffect(() => {
    async function guard() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login', { replace: true }); return }

      const uid = session.user.id
      setUserId(uid)
      setUserEmail(session.user.email)
      const fullName = session.user.user_metadata?.full_name || ''
      setUserName(fullName)
      setOfficerName(fullName) // pre-fill officer name from registration

      // Check if already completed
      const { data: officer } = await supabase
        .from('officers').select('*, tenants(*)').eq('id', uid).single()

      if (officer?.tenants?.onboarding_complete) {
        setTenantAndOfficer(officer.tenants, officer)
        navigate('/command', { replace: true })
        return
      }

      // If officer exists but incomplete — clean up and start fresh
      // (this handles partial wizard attempts)
      if (officer?.tenant_id) {
        // Delete incomplete records so wizard starts clean
        await supabase.from('gates').delete().eq('tenant_id', officer.tenant_id)
        await supabase.from('officers').delete().eq('id', uid)
        await supabase.from('tenants').delete().eq('id', officer.tenant_id)
      }

      setChecking(false)
    }
    guard()
  }, [])

  function handleSectorChange(s) {
    setSector(s)
    setDestinations(DEFAULT_DESTINATIONS[s] || DEFAULT_DESTINATIONS.other)
    setPurposes(DEFAULT_PURPOSES[s] || DEFAULT_PURPOSES.other)
  }

  // ── ATOMIC SAVE: everything at once at step 5 ──
  async function saveAll() {
    const validGates = gates.filter(g => g.name.trim())
    if (validGates.length === 0) { setError('Add at least one gate'); return }
    setSaving(true); setError('')

    const origin = window.location.origin

    try {
      // 1. INSERT tenant with ALL fields including destinations, purposes, complete flag
      const tenantSlug = installationName.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
        + '-' + Math.random().toString(36).slice(2, 6)

      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name: installationName.trim(),
          slug: tenantSlug,
          sector,
          city: city.trim(),
          state: stateName.trim(),
          is_active: true,
          onboarding_complete: true,
          custom_destinations: destinations,
          custom_purposes: purposes,
        })
        .select()
        .single()

      if (tenantErr) throw new Error('Could not create installation: ' + tenantErr.message)

      // 2. INSERT officer
      const { data: officer, error: officerErr } = await supabase
        .from('officers')
        .insert({
          id: userId,
          name: officerName.trim() || userName.trim(),
          rank: rank.trim() || null,
          email: userEmail,
          service_number: serviceNumber.trim().toUpperCase(),
          tenant_id: tenant.id,
          role: 'command',
          is_active: true,
        })
        .select('*, tenants(*)')
        .single()

      if (officerErr) {
        // Clean up tenant if officer insert fails
        await supabase.from('tenants').delete().eq('id', tenant.id)
        throw new Error('Could not create profile: ' + officerErr.message)
      }

      // 3. INSERT all gates
      // Note: we don't use .select().single() after insert because RLS SELECT
      // policy may not allow reading back immediately. Instead we build the
      // gate object from known data and verify by checking for errors only.
      const created = []
      for (const g of validGates) {
        const gSlug = g.name.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
          + '-' + Math.random().toString(36).slice(2, 6)

        const { error: gateErr } = await supabase
          .from('gates')
          .insert({
            tenant_id: tenant.id,
            name: g.name.trim(),
            slug: gSlug,
            location: g.location.trim() || null,
            is_active: true,
          })

        if (!gateErr) {
          // Build gate object from known data — no select needed
          created.push({
            id: gSlug, // use slug as temp key for display
            name: g.name.trim(),
            url: origin + '/gate/' + tenantSlug + '/' + gSlug
          })
        } else {
          console.error('Gate error for', g.name, ':', gateErr.message)
        }
      }

      // 4. Update auth store
      setTenantAndOfficer(officer.tenants, officer)
      setCreatedGates(created)

      // 5. Fire notification email
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
                    <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Officer</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;font-weight:600;">${rank.trim() ? rank.trim() + ' ' : ''}${officerName.trim() || userName.trim()}</td></tr>
                    <tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:12px;color:#6b7280;">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e6ed;font-size:14px;">${userEmail}</td></tr>
                    <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;">Gates</td><td style="padding:8px 0;font-size:14px;">${created.length} gate(s) created</td></tr>
                  </table>
                  <a href="https://app.sentri.ng/admin" style="display:block;margin-top:24px;background:#1a56db;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View in Superadmin →</a>
                </div>
                <div style="padding:16px 28px;border-top:1px solid #e2e6ed;font-size:11px;color:#9ca3af;">IGATA Technologies · SENTRi Platform</div>
              </div>
            </body></html>`
          })
        })
      } catch (emailErr) {
        console.error('Notification email error:', emailErr)
        // Don't fail the wizard for email errors
      }

      setSaving(false)
      setStep(6)

    } catch (e) {
      console.error('Wizard save error:', e)
      setError(e.message || 'Setup failed. Please try again.')
      setSaving(false)
    }
  }

  function copyUrl(gate) {
    navigator.clipboard.writeText(gate.url)
    setCopied(gate.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const profile = SECTOR_PROFILE[sector] || SECTOR_PROFILE.other
  const stepLabels = ['Installation', 'Profile', 'Destinations', 'Purposes', 'Gates']

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
            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: '8px' }}
              onClick={() => { if (!installationName.trim()) { setError('Installation name is required'); return } setError(''); setStep(2) }}
              disabled={!installationName.trim()}>
              Continue →
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
              <input type="text" placeholder="Your full name" value={officerName}
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
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep(1) }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { if (!officerName.trim()) { setError('Full name is required'); return } if (!serviceNumber.trim()) { setError(profile.idLabel + ' is required'); return } setError(''); setStep(3) }}
                disabled={!officerName.trim() || !serviceNumber.trim()}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Destinations */}
        {step === 3 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Destinations</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Where visitors go inside your facility. Pre-filled for {SECTORS.find(s => s.value === sector)?.label} — edit freely.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{dest}</span>
                  <button onClick={() => setDestinations(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
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
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep(2) }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { if (destinations.length === 0) { setError('Add at least one destination'); return } setError(''); setStep(4) }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Purposes */}
        {step === 4 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Visit purposes</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Why visitors come. Pre-filled for {SECTORS.find(s => s.value === sector)?.label} — edit freely.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {purposes.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px' }}>{p}</span>
                  <button onClick={() => setPurposes(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
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
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep(3) }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { if (purposes.length === 0) { setError('Add at least one purpose'); return } setError(''); setStep(5) }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Gates */}
        {step === 5 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your gates</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Add every gate or entry point. Each gets a unique URL for your guards.</p>
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

            {/* Summary before final save */}
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-2)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review before saving</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-2)' }}>Installation</span><span style={{ fontWeight: '600' }}>{installationName}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-2)' }}>Sector</span><span style={{ fontWeight: '600' }}>{SECTORS.find(s => s.value === sector)?.label}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-2)' }}>Officer</span><span style={{ fontWeight: '600' }}>{officerName}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-2)' }}>Destinations</span><span style={{ fontWeight: '600' }}>{destinations.length} configured</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: 'var(--text-2)' }}>Gates</span><span style={{ fontWeight: '600' }}>{gates.filter(g => g.name.trim()).length} to create</span></div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep(4) }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAll}
                disabled={saving || !gates.some(g => g.name.trim())}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Setting up your installation...</> : 'Complete setup →'}
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
