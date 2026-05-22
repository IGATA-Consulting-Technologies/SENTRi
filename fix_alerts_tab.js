// SENTRi — Fix AlertsTab query (no foreign key joins)
// Run with: node --input-type=commonjs < fix_alerts_tab.js

const fs = require('fs')
const { execSync } = require('child_process')

let tabs = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')

const oldAlertsLoad = `  async function load() {
    setLoading(true)
    const { data } = await supabase.from('flag_alerts').select('*, movements(plate_number, visitor_name, destination, purpose), watchlist(value, type, reason)').eq('tenant_id', tenant.id).order('alerted_at', { ascending: false }).limit(50)
    setAlerts(data || [])
    const unread = (data || []).filter(a => !a.acknowledged).length
    onUnreadChange(unread)
    setLoading(false)
  }`

const newAlertsLoad = `  async function load() {
    setLoading(true)
    // Fetch alerts without broken foreign key joins
    const { data: alertsData } = await supabase
      .from('flag_alerts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('alerted_at', { ascending: false })
      .limit(50)

    if (!alertsData) { setLoading(false); return }

    // Enrich each alert with movement and watchlist data
    const enriched = await Promise.all(alertsData.map(async (alert) => {
      const [{ data: movement }, { data: watchlistItem }] = await Promise.all([
        supabase.from('movements').select('plate_number, visitor_name, destination, purpose').eq('id', alert.movement_id).single(),
        alert.watchlist_id
          ? supabase.from('watchlist').select('value, type, reason').eq('id', alert.watchlist_id).single()
          : Promise.resolve({ data: null })
      ])
      return { ...alert, movements: movement, watchlist: watchlistItem }
    }))

    setAlerts(enriched)
    const unread = enriched.filter(a => !a.acknowledged).length
    onUnreadChange(unread)
    setLoading(false)
  }`

if (!tabs.includes(oldAlertsLoad)) {
  console.log('Pattern not found exactly — trying partial match...')
  // Try to find and replace just the select line
  tabs = tabs.replace(
    /const \{ data \} = await supabase\.from\('flag_alerts'\)\.select\('.*?'\)\.eq\('tenant_id', tenant\.id\)\.order\('alerted_at'.*?\)\.limit\(50\)/,
    `// Fetch alerts without foreign key joins
    const { data: alertsRaw } = await supabase
      .from('flag_alerts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('alerted_at', { ascending: false })
      .limit(50)
    const data = alertsRaw ? await Promise.all(alertsRaw.map(async (alert) => {
      const [{ data: movement }, { data: watchlistItem }] = await Promise.all([
        supabase.from('movements').select('plate_number, visitor_name, destination, purpose').eq('id', alert.movement_id).single(),
        alert.watchlist_id ? supabase.from('watchlist').select('value, type, reason').eq('id', alert.watchlist_id).single() : Promise.resolve({ data: null })
      ])
      return { ...alert, movements: movement, watchlist: watchlistItem }
    })) : []`
  )
  console.log('✓ Applied partial match fix')
} else {
  tabs = tabs.replace(oldAlertsLoad, newAlertsLoad)
  console.log('✓ Applied exact match fix')
}

fs.writeFileSync('src/pages/command/tabs.jsx', tabs, 'utf8')

// Verify
const written = fs.readFileSync('src/pages/command/tabs.jsx', 'utf8')
const hasNoJoin = !written.includes("movements(plate_number, visitor_name")
const hasNewQuery = written.includes('from movements') || written.includes("from('movements')")
console.log('✓ Broken join removed:', hasNoJoin)
console.log('✓ New separate query present:', hasNewQuery)

if (!hasNoJoin || !hasNewQuery) {
  console.log('Fix may not have applied correctly — check manually')
  process.exit(1)
}

console.log('\nPushing...')
execSync('git add -A', { stdio: 'inherit' })
execSync('git commit -m "Fix AlertsTab: remove broken FK join, use separate queries"', { stdio: 'inherit' })
execSync('git push origin main', { stdio: 'inherit' })
console.log('\n✓ Done. Netlify deploying in ~30 seconds.')
