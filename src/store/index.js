import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      officer: null,
      tenant: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,
      isOnline: navigator.onLine,

      restoreSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { set({ isAuthenticated: false, officer: null, tenant: null }); return }
          const { data: officerData } = await supabase
            .from('officers').select('*, tenants(*)')
            .eq('id', session.user.id).eq('is_active', true).single()
          if (!officerData) {
            set({ isAuthenticated: true, officer: null, tenant: null })
            return
          }
          set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true })
        } catch (e) {
          console.error('Session restore error:', e)
          set({ isAuthenticated: false, officer: null, tenant: null })
        }
      },

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
        set({ officer: null, tenant: null, isAuthenticated: false })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { set({ authLoading: false, authError: authError.message }); return { success: false } }

        const { data: officerData } = await supabase
          .from('officers').select('*, tenants(*)')
          .eq('id', authData.user.id).eq('is_active', true).single()

        if (!officerData) {
          set({ isAuthenticated: true, officer: null, tenant: null, authLoading: false, authError: null })
          return { success: true, newAccount: true }
        }

        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' })
          return { success: false }
        }

        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
        const onboardingComplete = officerData.tenants?.onboarding_complete ?? false
        return { success: true, role: officerData.role, tenantId: officerData.tenant_id, onboardingComplete }
      },

      setTenantAndOfficer: (tenant, officer) => set({ tenant, officer }),

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
      shiftGateId: null,   // persisted — used to validate shift belongs to this gate
      activeTab: 'admit',
      setTenant: (tenant) => set({ tenant }),
      setGate: (gate) => set({ gate }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setOnline: (val) => set({ isOnline: val }),
      startShift: (guard, gate, tenant, shiftLogId) => set({
        onShift: true, guard, gate, tenant, shiftLogId,
        shiftGateId: gate?.id || null,   // record which gate this shift belongs to
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),
      endShift: () => set({
        onShift: false, guard: null, shiftLogId: null,
        shiftStart: null, shiftGateId: null, activeTab: 'admit',
      }),
    }),
    {
      name: 'sentri-guard-shift',
      // gate and tenant are NOT persisted — always loaded fresh from Supabase via URL.
      // shiftGateId IS persisted — used to detect stale shifts from other gates.
      partialize: (state) => ({
        onShift: state.onShift,
        guard: state.guard,
        shiftStart: state.shiftStart,
        shiftLogId: state.shiftLogId,
        shiftGateId: state.shiftGateId,
        activeTab: state.activeTab,
      }),
    }
  )
)
