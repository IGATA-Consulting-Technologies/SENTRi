import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuthStore, useGuardStore } from './store'
import GateApp from './pages/gate/GateApp'
import CommandApp from './pages/command/CommandApp'
import AdminApp from './pages/admin/AdminApp'
import CommandLogin from './pages/auth/CommandLogin'
import ResetPassword from './pages/auth/ResetPassword'
import OnboardingWizard from './pages/auth/OnboardingWizard'
import NotFound from './pages/NotFound'
import PWAInstallPrompt from './components/PWAInstallPrompt'

function GateRoute() {
  const { tenantSlug, gateSlug } = useParams()
  return <GateApp tenantSlug={tenantSlug} gateSlug={gateSlug} />
}

function CommandRoute() {
  const { isAuthenticated, officer } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (officer?.role === 'admin') return <Navigate to="/admin" replace />
  return <CommandApp />
}

function OnboardingRoute() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <OnboardingWizard />
}

function AdminRoute() {
  return <AdminApp />
}

export default function App() {
  const { setOnline, restoreSession } = useAuthStore()
  const { setOnline: guardSetOnline } = useGuardStore()

  useEffect(() => {
    restoreSession()
    const on = () => { setOnline(true); guardSetOnline(true) }
    const off = () => { setOnline(false); guardSetOnline(false) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/gate/:tenantSlug/:gateSlug" element={<GateRoute />} />
        <Route path="/command/*" element={<CommandRoute />} />
        <Route path="/login" element={<CommandLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <PWAInstallPrompt />
    </BrowserRouter>
  )
}
