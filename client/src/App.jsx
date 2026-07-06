import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminRoute }     from '@/components/layout/AdminRoute'
import { AppLayout }      from '@/components/layout/AppLayout'
import { Login }          from '@/pages/Login'
import { Register }       from '@/pages/Register'
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
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Protected */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            } />

            {/* Challenge page has its own top bar — no AppLayout */}
            <Route path="/challenge/:id" element={
              <ProtectedRoute>
                <ChallengePage />
              </ProtectedRoute>
            } />

            {/* Full-page solution walkthrough — its own layout too, reached
                from MissionBrief's (locked) Solution tab */}
            <Route path="/challenge/:id/solution" element={
              <ProtectedRoute>
                <SolutionPage />
              </ProtectedRoute>
            } />

            <Route path="/scoreboard" element={
              <ProtectedRoute>
                <AppLayout><Scoreboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/assessment" element={
              <ProtectedRoute>
                <AppLayout><Assessment /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/progress" element={
              <ProtectedRoute>
                <AppLayout><Progress /></AppLayout>
              </ProtectedRoute>
            } />

            {/* Placeholder routes — implemented in later phases */}
            <Route path="/hints" element={
              <ProtectedRoute>
                <AppLayout><Placeholder label="Hints used — Phase 5" /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/components" element={
              <ProtectedRoute>
                <AppLayout><Placeholder label="Components — coming soon" /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <AppLayout><Placeholder label="Settings — coming soon" /></AppLayout>
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

            {/* Redirect root */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
