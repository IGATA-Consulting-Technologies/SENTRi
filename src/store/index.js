import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

// ============================================================
// COMMAND / AUTH STORE
// For COS, CO, Admin logins
// ============================================================
export const useAuthStore = create(
  persist(
    (set) => ({
      officer: null,
      tenant: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,
      isOnline: navigator.onLine,

      setOnline: (v) => set({ isOnline: v }),

      login: async (email, password) => {
        set({ authLoading: true, authError: null })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error

          const { data: officer, error: oErr } = await supabase
            .from('officers')
            .select('*, tenants(*)')
            .eq('email', email)
            .eq('is_active', true)
            .single()

          if (oErr || !officer) throw new Error('Officer profile not found.')

          await supabase.from('officers').update({ last_login: new Date().toISOString() }).eq('id', officer.id)

          set({
            officer,
            tenant: officer.tenants,
            isAuthenticated: true,
            authLoading: false,
            authError: null
          })

          return { success: true, role: officer.role }
        } catch (err) {
          set({ authLoading: false, authError: err.message || 'Login failed.' })
          return { success: false }
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ officer: null, tenant: null, isAuthenticated: false })
      },

      restoreSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return false
        const { data: officer } = await supabase
          .from('officers')
          .select('*, tenants(*)')
          .eq('email', session.user.email)
          .single()
        if (officer) {
          set({ officer, tenant: officer.tenants, isAuthenticated: true })
          return true
        }
        return false
      }
    }),
    {
      name: 'sentri-auth',
      partialize: (s) => ({ officer: s.officer, tenant: s.tenant, isAuthenticated: s.isAuthenticated })
    }
  )
)

// ============================================================
// GUARD SHIFT STORE
// No login — shift-based identity. Persisted on device.
// ============================================================
export const useGuardStore = create(
  persist(
    (set) => ({
      onShift: false,
      guard: null,         // { name, serviceNumber, rank }
      gate: null,          // { id, name, slug, tenant_id }
      tenant: null,        // { id, name, slug, logo_url, sector }
      shiftStart: null,
      shiftLogId: null,
      activeTab: 'admit',
      isOnline: navigator.onLine,

      setOnline: (v) => set({ isOnline: v }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      startShift: (guard, gate, tenant, shiftLogId) => set({
        onShift: true,
        guard,
        gate,
        tenant,
        shiftLogId,
        shiftStart: new Date().toISOString(),
        activeTab: 'admit'
      }),

      endShift: () => set({
        onShift: false,
        guard: null,
        gate: null,
        tenant: null,
        shiftLogId: null,
        shiftStart: null
      })
    }),
    {
      name: 'sentri-guard-shift',
      partialize: (s) => ({
        onShift: s.onShift,
        guard: s.guard,
        gate: s.gate,
        tenant: s.tenant,
        shiftLogId: s.shiftLogId,
        shiftStart: s.shiftStart
      })
    }
  )
)
