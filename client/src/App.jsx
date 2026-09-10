import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminRoute }     from '@/components/layout/AdminRoute'
import { ConsentGate }    from '@/components/layout/ConsentGate'
import { AppLayout }      from '@/components/layout/AppLayout'
import { Toaster }        from '@/components/ui/toaster'
import { Login }          from '@/pages/Login'
import { Register }       from '@/pages/Register'
import { Consent }        from '@/pages/Consent'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword }  from '@/pages/ResetPassword'
import { Dashboard }      from '@/pages/Dashboard'
import { ChallengePage }  from '@/pages/ChallengePage'
import { SolutionPage }   from '@/pages/SolutionPage'
import { Scoreboard }     from '@/pages/Scoreboard'
import { Assessment }     from '@/pages/Assessment'
import { SecurityCentre } from '@/pages/SecurityCentre'
import { Progress }       from '@/pages/Progress'
import { ResearchAnalytics } from '@/pages/ResearchAnalytics'
import { AdminInvites }     from '@/pages/AdminInvites'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        30_000,
      gcTime:           5 * 60_000,
      retry:            1,
      refetchOnWindowFocus: false,
    },
  },
})

// Sidebar-nav placeholder pages not yet implemented — kept inside
// AppLayout so the sidebar (and its active-link highlighting) stays
// visible instead of falling through the catch-all route to /login.
function Placeholder({ label }) {
  return (
    <div className="h-full flex items-center justify-center text-text-2">
      {label}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Authenticated-only, deliberately NOT wrapped in ConsentGate —
                this is where consent gets recorded, so gating it would trap
                a not-yet-consented participant with nowhere to go. */}
            <Route path="/consent" element={
              <ProtectedRoute>
                <Consent />
              </ProtectedRoute>
            } />

            {/* Every route below is study content — ConsentGate (inside
                ProtectedRoute) redirects to /consent unless the account is
                exempt (admin / original cohort) or has completed consent.
                This mirrors, in the UI, what the server's requireConsent
                middleware already enforces on every study API call — see
                server/middleware/consent.js. */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Dashboard /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />

            {/* Challenge page has its own top bar — no AppLayout */}
            <Route path="/challenge/:id" element={
              <ProtectedRoute>
                <ConsentGate>
                  <ChallengePage />
                </ConsentGate>
              </ProtectedRoute>
            } />

            {/* Full-page solution walkthrough — its own layout too, reached
                from MissionBrief's (locked) Solution tab */}
            <Route path="/challenge/:id/solution" element={
              <ProtectedRoute>
                <ConsentGate>
                  <SolutionPage />
                </ConsentGate>
              </ProtectedRoute>
            } />

            <Route path="/scoreboard" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Scoreboard /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />
            <Route path="/assessment" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Assessment /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />

            <Route path="/progress" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Progress /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />

            <Route path="/hints" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Placeholder label="Hints used — Phase 5" /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />
            <Route path="/components" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Placeholder label="Components — coming soon" /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <ConsentGate>
                  <AppLayout><Placeholder label="Settings — coming soon" /></AppLayout>
                </ConsentGate>
              </ProtectedRoute>
            } />
            <Route path="/admin/*" element={
              <AdminRoute>
                <AppLayout><Placeholder label="Admin panel — Phase 5" /></AppLayout>
              </AdminRoute>
            } />
            <Route path="/admin/security" element={
              <AdminRoute>
                <AppLayout><SecurityCentre /></AppLayout>
              </AdminRoute>
            } />
            <Route path="/admin/analytics" element={
              <AdminRoute>
                <AppLayout><ResearchAnalytics /></AppLayout>
              </AdminRoute>
            } />
            <Route path="/admin/invites" element={
              <AdminRoute>
                <AppLayout><AdminInvites /></AppLayout>
              </AdminRoute>
            } />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
