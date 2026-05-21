const fs = require('fs');
const { execSync } = require('child_process');

// Zustand 4.x with persist - correct syntax
const store = `import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set) => ({
      officer: null,
      tenant: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,
      isOnline: navigator.onLine,

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          set({ authLoading: false, authError: authError.message })
          return
        }
        const { data: officerData, error: officerError } = await supabase
          .from('officers')
          .select('*, tenants(*)')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single()
        if (officerError || !officerData) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Officer profile not found.' })
          return
        }
        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' })
          return
        }
        set({
          officer: officerData,
          tenant: officerData.tenants,
          isAuthenticated: true,
          authLoading: false,
          authError: null,
        })
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ officer: null, tenant: null, isAuthenticated: false })
      },

      setOnline: (val) => set({ isOnline: val }),
    }),
    {
      name: 'sentri-auth',
      partialize: (state) => ({
        officer: state.officer,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useGuardStore = create(
  persist(
    (set) => ({
      onShift: false,
      guard: null,
      gate: null,
      tenant: null,
      shiftStart: null,
      shiftLogId: null,
      activeTab: 'admit',

      setTenant: (tenant) => set({ tenant }),
      setGate: (gate) => set({ gate }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      startShift: ({ guard, shiftLogId }) => set({
        onShift: true,
        guard,
        shiftLogId,
        shiftStart: new Date().toISOString(),
        activeTab: 'admit',
      }),

      endShift: () => set({
        onShift: false,
        guard: null,
        shiftLogId: null,
        shiftStart: null,
        activeTab: 'admit',
      }),
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (state) => ({
        onShift: state.onShift,
        guard: state.guard,
        gate: state.gate,
        tenant: state.tenant,
        shiftStart: state.shiftStart,
        shiftLogId: state.shiftLogId,
        activeTab: state.activeTab,
      }),
    }
  )
)
`;

fs.mkdirSync('src/store', { recursive: true });
fs.writeFileSync('src/store/index.js', store, 'utf8');
console.log('Store fixed');

// Also check if the original store file from Phase 1 had different syntax
// The issue might be in CommandLogin.jsx using the old store shape
// Let's also check CommandLogin.jsx exists and uses correct import
const loginPath = 'src/pages/auth/CommandLogin.jsx';
if (fs.existsSync(loginPath)) {
  const login = fs.readFileSync(loginPath, 'utf8');
  console.log('CommandLogin first 5 lines:', login.split('\n').slice(0, 5).join('\n'));
} else {
  console.log('CommandLogin.jsx NOT FOUND - this is the problem!');
}

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix store and diagnose login issue"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done');
