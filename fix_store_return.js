const fs = require('fs');
const { execSync } = require('child_process');

let store = fs.readFileSync('src/store/index.js', 'utf8');

// Fix: make login return { success, role } as CommandLogin.jsx expects
const oldLogin = `        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' }); return
        }
        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
      },`;

const newLogin = `        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' })
          return { success: false }
        }
        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
        return { success: true, role: officerData.role }
      },`;

if (store.includes(oldLogin)) {
  store = store.replace(oldLogin, newLogin);
  fs.writeFileSync('src/store/index.js', store, 'utf8');
  console.log('Store login fixed - now returns { success, role }');
} else {
  console.log('Pattern not found - printing store for inspection:');
  console.log(store);
}

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix store login to return success and role as CommandLogin expects"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
