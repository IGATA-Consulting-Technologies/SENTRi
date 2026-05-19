import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGuardStore } from '../../store'

export default function ShiftStart({ gateData, tenantData }) {
  const { startShift } = useGuardStore()
  const [step, setStep] = useState(1)
  const [serviceNumber, setServiceNumber] = useState('')
  const [name, setName] = useState('')
  const [rank, setRank] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [guardRecord, setGuardRecord] = useState(null)

  async function verifyIdentity() {
    if (!serviceNumber.trim() || !name.trim()) { setError('Please enter your service number and full name.'); return }
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
        if (!nameMatch) { setError('Name does not match records. Please check and try again.'); setLoading(false); return }
        setGuardRecord(data)
      } else {
        setGuardRecord({ name: name.trim(), service_number: serviceNumber.trim().toUpperCase(), rank: rank.trim() })
      }
      setStep(2)
    } catch {
      setGuardRecord({ name: name.trim(), service_number: serviceNumber.trim().toUpperCase(), rank: rank.trim() })
      setStep(2)
    } finally { setLoading(false) }
  }

  async function beginShift() {
    setLoading(true)
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

      startShift(
        { name: guardRecord.name, serviceNumber: guardRecord.service_number, rank: guardRecord.rank || rank },
        gateData,
        tenantData,
        shiftLog?.id || null
      )
    } catch {
      startShift(
        { name: guardRecord.name, serviceNumber: guardRecord.service_number, rank: rank },
        gateData,
        tenantData,
        null
      )
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f2f5 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="fade-up">

        {/* Installation branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {tenantData?.logo_url
            ? <img src={tenantData.logo_url} alt="logo" style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', margin: '0 auto 12px', display: 'block' }} />
            : <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}>
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

        {/* Step bars */}
        <div className="steps">
          {[1, 2, 3].map(s => <div key={s} className={`step-bar ${step >= s ? 'active' : ''}`} />)}
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
              <label>Service number</label>
              <input type="text" placeholder="e.g. N/12345" value={serviceNumber}
                onChange={e => setServiceNumber(e.target.value.toUpperCase())}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontSize: '16px' }} />
            </div>
            <div className="field">
              <label>Rank</label>
              <input type="text" placeholder="e.g. Sgt, Cpl, Pvt" value={rank}
                onChange={e => setRank(e.target.value)} autoCapitalize="words" />
            </div>
            <div className="field" style={{ marginBottom: '20px' }}>
              <label>Full name</label>
              <input type="text" placeholder="Your full name" value={name}
                onChange={e => setName(e.target.value)} autoCapitalize="words" />
            </div>
            {error && <div className="alert alert-warn">{error}</div>}
            <button className="btn btn-primary btn-full btn-lg" onClick={verifyIdentity}
              disabled={loading || !serviceNumber || !name}>
              {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Verifying...</> : 'Continue →'}
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
                { label: 'Officer', value: `${guardRecord.rank || rank} ${guardRecord.name}`.trim() },
                { label: 'Service No.', value: guardRecord.service_number, mono: true },
                { label: 'Gate', value: gateData?.name },
                { label: 'Installation', value: tenantData?.name },
                { label: 'Shift start', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-display)', color: 'var(--text-0)' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '14px 20px' }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={beginShift} disabled={loading}>
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
