const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('SENTRi — Fix duplicate imports in tabs.jsx')
console.log('='.repeat(50))

const filePath = path.join(process.cwd(), 'src', 'pages', 'command', 'tabs.jsx')

if (!fs.existsSync(filePath)) {
  console.log('✗ File not found:', filePath)
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf8')

// The duplicate import block that appears before GatesTab
const duplicate = `// GatesTab.jsx ─ Gate management with create form
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'`

const replacement = `// GatesTab.jsx ─ Gate management with create form`

if (!content.includes("import { useState, useEffect } from 'react'\nimport { supabase } from '../../lib/supabase'\nimport { useAuthStore } from '../../store'\n\nexport function GatesTab")) {
  // Try alternate: just strip the three duplicate import lines before GatesTab
  const dupPattern = /\/\/ GatesTab\.jsx[^\n]*\nimport \{ useState, useEffect \} from 'react'\nimport \{ supabase \} from '\.\.\/\.\.\/lib\/supabase'\nimport \{ useAuthStore \} from '\.\.\/\.\.\/store'\n/
  if (dupPattern.test(content)) {
    content = content.replace(dupPattern, '// GatesTab.jsx ─ Gate management with create form\n')
    console.log('✓ Removed duplicate import block before GatesTab')
  } else {
    console.log('✗ Could not find duplicate import pattern — checking manually...')
    // Count imports of useState
    const importMatches = content.match(/import \{ useState/g)
    console.log('  useState import count:', importMatches ? importMatches.length : 0)
    process.exit(1)
  }
} else {
  content = content.replace(
    "// GatesTab.jsx ─ Gate management with create form\nimport { useState, useEffect } from 'react'\nimport { supabase } from '../../lib/supabase'\nimport { useAuthStore } from '../../store'",
    "// GatesTab.jsx ─ Gate management with create form"
  )
  console.log('✓ Removed duplicate import block before GatesTab')
}

// Verify only one useState import remains
const remainingImports = (content.match(/import \{ useState/g) || []).length
console.log('✓ useState import count after fix:', remainingImports)
if (remainingImports !== 1) {
  console.log('✗ Expected exactly 1 useState import, found', remainingImports)
  process.exit(1)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('✓ File written')

// Git
try {
  execSync('git add src/pages/command/tabs.jsx', { stdio: 'inherit' })
  execSync('git commit -m "Fix: remove duplicate imports in tabs.jsx (caused Vite build failure)"', { stdio: 'inherit' })
  execSync('git push origin main', { stdio: 'inherit' })
  console.log('✓ Pushed to GitHub — Netlify deploying now')
} catch (e) {
  console.log('✗ Git error:', e.message)
  process.exit(1)
}

console.log('')
console.log('Done. Check Netlify in ~60 seconds.')
