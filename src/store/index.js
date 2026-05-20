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
      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) { set({ authLoading: false, authError: authError.message }); return }
        const { data: officerData, error: officerError } = await supabase
          .from('officers').select('*, tenants(*)').eq('id', authData.user.id).eq('is_active', true).single()
        if (officerError || !officerData) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Officer profile not found.' }); return
        }
        if (!['command', 'admin'].includes(officerData.role)) {
          await supabase.auth.signOut()
          set({ authLoading: false, authError: 'Insufficient access level.' }); return
        }
        set({ officer: officerData, tenant: officerData.tenants, isAuthenticated: true, authLoading: false, authError: null })
      },
      logout: async () => {
        await supabase.auth.signOut()
        set({ officer: null, tenant: null, isAuthenticated: false })
      },
      setOnline: (val) => set({ isOnline: val }),
    }),
    {
      name: 'sentri-auth',
      partialize: (s) => ({ officer: s.officer, tenant: s.tenant, isAuthenticated: s.isAuthenticated }),
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
        onShift: true, guard, shiftLogId,
        shiftStart: new Date().toISOString(), activeTab: 'admit',
      }),
      endShift: () => set({ onShift: false, guard: null, shiftLogId: null, shiftStart: null, activeTab: 'admit' }),
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (s) => ({
        onShift: s.onShift, guard: s.guard, gate: s.gate, tenant: s.tenant,
        shiftStart: s.shiftStart, shiftLogId: s.shiftLogId, activeTab: s.activeTab,
      }),
    }
  )
)
