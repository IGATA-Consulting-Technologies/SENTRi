import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

const DEFAULT_DESTINATIONS = {
  military: ['Administration Block', 'Officers Mess', 'Barracks / Quarters', 'Armoury', 'Medical Centre', 'Sports Complex', 'Provost Office', 'Signals Unit', 'Quartermaster Store', 'Commanding Officer Office'],
  oil_gas: ['Control Room', 'Wellhead Area', 'Refinery Block', 'Admin Building', 'Warehouse', 'Maintenance Bay', 'HSE Office', 'Canteen', 'Medical Bay', 'Security Post'],
  bank: ['Banking Hall', 'Vault Area', 'Executive Floor', 'IT Room', 'HR Office', 'Board Room', 'Customer Service', 'Back Office', 'ATM Room', 'Security Room'],
  corporate: ['Reception', 'Executive Suite', 'Conference Room', 'IT Department', 'Finance', 'HR Department', 'Operations', 'Warehouse', 'Cafeteria', 'Server Room'],
  other: ['Main Office', 'Reception', 'Meeting Room', 'Warehouse', 'Security Post', 'Management Office', 'Staff Area', 'Visitor Lounge']
}

const DEFAULT_PURPOSES = {
  military: ['Official visit', 'Delivery / Supply', 'Maintenance / Repair', 'Training', 'Personal visit', 'Medical', 'Contractor / Vendor'],
  oil_gas: ['Official visit', 'Contractor / Vendor', 'HSE Inspection', 'Maintenance', 'Delivery', 'Emergency Response', 'Audit', 'Training'],
  bank: ['Official visit', 'Audit', 'IT Support', 'Delivery', 'Meeting', 'Contractor', 'Regulatory Visit', 'Training'],
  corporate: ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Interview', 'Training', 'Client Visit'],
  other: ['Official visit', 'Meeting', 'Delivery', 'Maintenance', 'Contractor', 'Personal visit', 'Training']
}

const SECTORS = [
  { value: 'military', label: 'Military / Defence', icon: '🛡️' },
  { value: 'oil_gas', label: 'Oil & Gas', icon: '⚙️' },
  { value: 'bank', label: 'Banking / Finance', icon: '🏦' },
  { value: 'corporate', label: 'Corporate', icon: '🏢' },
  { value: 'other', label: 'Other', icon: '🏛️' },
]

export default function OnboardingWizard() {
  const { tenant, officer } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Installation details
  const [sector, setSector] = useState(tenant?.sector || 'military')
  const [branch, setBranch] = useState(tenant?.branch || '')
  const [city, setCity] = useState(tenant?.city || '')
  const [state, setState] = useState(tenant?.state || '')

  // Step 2 — Gates
  const [gates, setGates] = useState([{ name: '', location: '' }])

  // Step 3 — Destinations
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS['military'])
  const [newDest, setNewDest] = useState('')

  // Step 4 — Purposes
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES['military'])
  const [newPurpose, setNewPurpose] = useState('')

  function handleSectorChange(s) {
    setSector(s)
    setDestinations(DEFAULT_DESTINATIONS[s] || DEFAULT_DESTINATIONS.other)
    setPurposes(DEFAULT_PURPOSES[s] || DEFAULT_PURPOSES.other)
  }

  async function saveStep1() {
    if (!sector) { setError('Please select your sector'); return }
    setSaving(true)
    await supabase.from('tenants').update({ sector, branch: branch.trim(), city: city.trim(), state: state.trim() }).eq('id', tenant.id)
    setSaving(false); setStep(2)
  }

  async function saveStep2() {
    const validGates = gates.filter(g => g.name.trim())
    if (validGates.length === 0) { setError('Add at least one gate'); return }
    setSaving(true)
    for (const g of validGates) {
      const slug = g.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
      await supabase.from('gates').insert({
        tenant_id: tenant.id,
        name: g.name.trim(),
        slug: slug + '-' + Math.random().toString(36).slice(2, 6),
        location: g.location.trim() || null,
        is_active: true
      })
    }
    setSaving(false); setStep(3)
  }

  async function saveStep3() {
    if (destinations.length === 0) { setError('Add at least one destination'); return }
    setSaving(true)
    await supabase.from('tenants').update({ custom_destinations: destinations }).eq('id', tenant.id)
    setSaving(false); setStep(4)
  }

  async function saveStep4() {
    if (purposes.length === 0) { setError('Add at least one purpose'); return }
    setSaving(true)
    await supabase.from('tenants').update({ custom_purposes: purposes, onboarding_complete: true }).eq('id', tenant.id)
    setSaving(false); setStep(5)
  }

  const progress = (step / 5) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '52px', height: '52px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(26,86,219,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Welcome to SENTRi</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Let's set up your installation. Takes about 3 minutes.</p>
        </div>

        {/* Progress */}
        {step < 5 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              {['Details', 'Gates', 'Destinations', 'Purposes'].map((label, i) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-3)', color: step >= i + 1 ? 'white' : 'var(--text-2)' }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '10px', color: step === i + 1 ? 'var(--accent)' : 'var(--text-2)', fontWeight: step === i + 1 ? '600' : '400' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: progress + '%', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* STEP 1 — Installation Details */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Installation details</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Tell us about your facility so SENTRi is configured correctly.</p>

            <div style={{ marginBottom: '20px' }}>
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
                <label>Branch / Division</label>
                <input type="text" placeholder="e.g. Army, Navy" value={branch} onChange={e => setBranch(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>City</label>
                <input type="text" placeholder="e.g. Lagos" value={city} onChange={e => setCity(e.target.value)} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: '24px' }}>
              <label>State</label>
              <input type="text" placeholder="e.g. Lagos State" value={state} onChange={e => setState(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={saveStep1} disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Saving...</> : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 2 — Gates */}
        {step === 2 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Your gates</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Add every gate or entry point at your facility. Each gets its own guard PWA URL.</p>

            {gates.map((gate, i) => (
              <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate {i + 1}</span>
                  {gates.length > 1 && <button onClick={() => setGates(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                </div>
                <div className="field-row">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Gate name *</label>
                    <input type="text" placeholder="e.g. Main Gate" value={gate.name} onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Location (optional)</label>
                    <input type="text" placeholder="e.g. North entrance" value={gate.location} onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, location: e.target.value } : g))} />
                  </div>
                </div>
              </div>
            ))}

            <button className="btn btn-outline btn-full" style={{ marginBottom: '20px' }} onClick={() => setGates(prev => [...prev, { name: '', location: '' }])}>
              + Add another gate
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep2() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Destinations */}
        {step === 3 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Destinations</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              These are the locations inside your facility that visitors go to. Guards select from this list when admitting entries.
              We've pre-filled common ones for your sector — edit freely.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {destinations.map((dest, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-0)' }}>{dest}</span>
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
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep3() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Purposes */}
        {step === 4 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Visit purposes</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Why do visitors come to your facility? Guards select the purpose when admitting entries.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {purposes.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-0)' }}>{p}</span>
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
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setError(''); saveStep4() }} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Saving...</> : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Complete */}
        {step === 5 && (
          <div className="card fade-up" style={{ padding: '32px', textAlign: 'center' }}>
            <div className="pop" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 24px rgba(14,124,58,0.25)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Setup complete!</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '8px' }}>
              Your installation is ready. Go to the Gates tab to get your guard PWA URLs and send them to your officers.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '28px' }}>
              Welcome to SENTRi.
            </p>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/command')}>
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
