import { create } from 'zustand'
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

      restoreSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { set({ isAuthenticated: false, officer: null, tenant: null }); return }
        const { data: officerData } = await supabase
          .from('officers').select('*, tenants(*)')
          .eq('id', session.user.id).eq('is_active', true).single()
        if (!officerData) { set({ isAuthenticated: false, officer: null, tenant: null }); return }
          set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true })
        } catch (e) {
          console.error('Session restore error:', e)
          set({ isAuthenticated: false, officer: null, tenant: null })
        }
      },

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { set({ authLoading: false, authError: authError.message }); return }
        const { data: officerData, error: officerError } = await supabase
          .from('officers').select('*, tenants(*)')
          .eq('id', authData.user.id).eq('is_active', true).single()
        if (officerError || !officerData) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Officer profile not found.' }); return
        }
        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' })
          return { success: false }
        }
        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
        return { success: true, role: officerData.role, tenantId: officerData.tenant_id }
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
      setOnline: (val) => set({ isOnline: val }),

      startShift: (guard, gate, tenant, shiftLogId) => set({
        onShift: true, guard, gate, tenant, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),

      endShift: () => set({
        onShift: false, guard: null, shiftLogId: null, shiftStart: null, activeTab: 'admit',
      }),
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (state) => ({
        onShift: state.onShift, guard: state.guard, gate: state.gate,
        tenant: state.tenant, shiftStart: state.shiftStart,
        shiftLogId: state.shiftLogId, activeTab: state.activeTab,
      }),
    }
  )
)
