import { Navigate } from 'react-router-dom'
import { useConsentStatus } from '@/hooks/useConsent'


export function ConsentGate({ children }) {
  const { data: status, isLoading, isError } = useConsentStatus()

  if (isLoading) return <GateLoadingScreen />

  // A transient fetch failure shouldn't trap the user on a blank screen —
  // fall through and let the page render. If consent genuinely isn't
  // recorded, the server's own guard will reject the page's API calls;
  // this component only ever affects what the UI shows, never enforcement.
  if (isError) return children

  if (status.exempt || status.completed) return children

  return <Navigate to="/consent" replace />
}

function GateLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
