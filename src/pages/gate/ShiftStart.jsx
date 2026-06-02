import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

// Sector config — controls what identity fields the guard sees
function getSectorConfig(sector) {
  switch (sector) {
    case 'military':
      return {
        idLabel: 'Service number',
        idPlaceholder: 'e.g. N/12345',
        idMono: true,
        showRank: true,
        rankLabel: 'Rank',
        rankPlaceholder: 'e.g. Sgt, Cpl, Lt',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => [g.rank, g.name].filter(Boolean).join(' '),
      }
    case 'oil_gas':
      return {
        idLabel: 'Staff ID',
        idPlaceholder: 'e.g. OG/12345',
        idMono: true,
        showRank: false,
        rankLabel: 'Department',
        rankPlaceholder: 'e.g. HSE, Operations',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'banking':
      return {
        idLabel: 'Staff ID',
        idPlaceholder: 'e.g. BK/00123',
        idMono: true,
        showRank: false,
        rankLabel: 'Branch / Unit',
        rankPlaceholder: 'e.g. Security, Operations',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'corporate':
      return {
        idLabel: 'Employee ID',
        idPlaceholder: 'e.g. EMP/456',
        idMono: true,
        showRank: false,
        rankLabel: 'Department',
        rankPlaceholder: 'e.g. Facilities, Security',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    case 'government':
      return {
        idLabel: 'Staff ID / Grade',
        idPlaceholder: 'e.g. GL07/1234',
        idMono: true,
        showRank: false,
        rankLabel: 'Ministry / Agency',
        rankPlaceholder: 'e.g. Ministry of Defence',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
    default:
      return {
        idLabel: 'ID number',
        idPlaceholder: 'Your ID number',
        idMono: true,
        showRank: false,
        rankLabel: 'Department / Unit',
        rankPlaceholder: 'Optional',
        nameLabel: 'Full name',
        displayId: (g) => g.serviceNumber,
        displayTitle: (g) => g.name,
      }
  }
}

export default function ShiftStart({ gateData, tenantData }) {
  const { startShift } = useGuardStore()
  const sector = tenantData?.sector || 'other'
  const config = getSectorConfig(sector)

  const [step, setStep] = useState(1)
  const [serviceNumber, setServiceNumber] = useState('')
  const [name, setName] = useState('')
  const [rank, setRank] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [guardRecord, setGuardRecord] = useState(null)

  async function verifyIdentity() {
    if (!serviceNumber.trim() || !name.trim()) {
      setError('Please enter your ' + config.idLabel.toLowerCase() + ' and full name.')
      return
    }
    setLoading(true); setError('')
    try {
      const { data } = await supabase
        .from('officers')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('service_number', serviceNumber.trim().toUpperCase())
        .eq('is_active', true)
        .single()

      if (data) {
        const nameMatch = data.name.toLowerCase().includes(name.trim().toLowerCase().split(' ')[0].toLowerCase())
        if (!nameMatch) {
          setError('Name does not match records. Please check and try again.')
          setLoading(false); return
        }
        setGuardRecord(data)
      } else {
        setGuardRecord({
          name: name.trim(),
          service_number: serviceNumber.trim().toUpperCase(),
          rank: rank.trim()
        })
      }
      setStep(2)
    } catch {
      setGuardRecord({
        name: name.trim(),
        service_number: serviceNumber.trim().toUpperCase(),
        rank: rank.trim()
      })
      setStep(2)
    } finally { setLoading(false) }
  }

  async function beginShift() {
    setLoading(true)
    const guardObj = {
      name: guardRecord.name,
      serviceNumber: guardRecord.service_number,
      rank: guardRecord.rank || rank || '',
      officerId: guardRecord.id || null,  // officer UUID — written to movements.entry_officer_id
    }
    try {
      const { data: shiftLog } = await supabase
        .from('shift_logs')
        .insert({
          tenant_id: tenantData.id,
          gate_id: gateData.id,
          officer_name: guardRecord.name,
          service_number: guardRecord.service_number,
          shift_start: new Date().toISOString()
        })
        .select()
        .single()

      startShift(guardObj, gateData, tenantData, shiftLog?.id || null)
    } catch {
      startShift(guardObj, gateData, tenantData, null)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      background: 'linear-gradient(160deg, #e8f5ee 0%, #f0f5f2 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {tenantData?.logo_url
            ? <img src={tenantData.logo_url} alt="logo" style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', margin: '0 auto 12px', display: 'block' }} />
            : <div style={{ width: '60px', height: '60px', background: 'var(--green)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 20px rgba(14,124,58,0.3)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
          }
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '2px' }}>
            {tenantData?.name || 'SENTRi'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{gateData?.name}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SENTRi Gate Intelligence
          </p>
        </div>

        <div className="steps">
          {[1, 2].map(s => <div key={s} className={`step-bar ${step >= s ? 'active' : ''}`} />)}
        </div>

        {/* Step 1 — Identity */}
        {step === 1 && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              Confirm your identity
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              All entries this shift will be logged under your name.
            </p>

            <div className="field">
              <label>{config.idLabel}</label>
              <input type="text" placeholder={config.idPlaceholder} value={serviceNumber}
                onChange={e => setServiceNumber(e.target.value.toUpperCase())}
                style={{ fontFamily: config.idMono ? 'var(--font-mono)' : 'inherit', letterSpacing: config.idMono ? '0.06em' : 0, fontSize: '16px' }} />
            </div>

            {config.showRank && (
              <div className="field">
                <label>{config.rankLabel}</label>
                <input type="text" placeholder={config.rankPlaceholder} value={rank}
                  onChange={e => setRank(e.target.value)} autoCapitalize="words" />
              </div>
            )}

            <div className="field" style={{ marginBottom: '20px' }}>
              <label>{config.nameLabel}</label>
              <input type="text" placeholder="Your full name" value={name}
                onChange={e => setName(e.target.value)} autoCapitalize="words" />
            </div>

            {error && <div className="alert alert-warn" style={{ marginBottom: '16px' }}>{error}</div>}

            <button className="btn btn-full btn-lg" style={{ background: 'var(--green)', color: 'white', border: 'none' }} onClick={verifyIdentity}
              disabled={loading || !serviceNumber.trim() || !name.trim()}>
              {loading
                ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Verifying...</>
                : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && guardRecord && (
          <div className="card fade-up" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
              Ready to start shift?
            </h2>
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
              {[
                { label: 'Officer', value: config.displayTitle(guardRecord) },
                { label: config.idLabel, value: guardRecord.service_number, mono: true },
                { label: 'Gate', value: gateData?.name },
                { label: 'Installation', value: tenantData?.name },
                { label: 'Shift start', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-display)', color: 'var(--text-0)' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '14px 20px' }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-lg" style={{ flex: 1, background: 'var(--green)', color: 'white', border: 'none' }} onClick={beginShift} disabled={loading}>
                {loading ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : '✓ Begin shift'}
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-2)', marginTop: '16px' }}>
          SENTRi by IGATA Technologies · All movement is recorded
        </p>
      </div>
    </div>
  )
}
