import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Link2Off } from 'lucide-react'
import api from '@/services/api'

// The backend builds the link from its own configured CLIENT_ORIGIN, which
// may not match the browser's actual origin (e.g. behind a reverse proxy)
// — so route via the path/query only, not the absolute URL.
function toRelativePath(absoluteUrl) {
  const url = new URL(absoluteUrl)
  return `${url.pathname}${url.search}`
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')

  const forgotMutation = useMutation({
    mutationFn: (data) => api.post('/auth/forgot-password', data).then(r => r.data),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    forgotMutation.mutate({ email })
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center
                 justify-center p-4"
      style={{
        backgroundImage: 'radial-gradient(circle, #30363D 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-surface rounded-lg flex items-center
                          justify-center border border-border">
            <Link2Off size={20} className="text-accent" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            <span className="text-text-1">Chain</span>
            <span className="text-accent">Break</span>
          </span>
        </div>
        <p className="text-text-2 text-sm">Reset your password</p>
      </div>

      <div className="w-full max-w-sm bg-surface border border-border
                      rounded-xl p-8">
        <h1 className="text-text-1 text-xl font-medium mb-2">
          Forgot password?
        </h1>
        <p className="text-text-2 text-sm mb-6">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {forgotMutation.isSuccess ? (
          <div className="flex flex-col gap-4">
            <div className="bg-success/10 border border-success/30 rounded-lg
                            px-3 py-2 text-success text-sm">
              {forgotMutation.data.message}
            </div>

            {/* Dev-mode only: no email provider is configured yet, so the
                backend hands back the reset link directly for local testing. */}
            {forgotMutation.data.resetUrl && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg
                              px-3 py-2 text-text-2 text-xs break-all">
                <p className="text-warning font-medium mb-1">Dev mode — no email sender configured</p>
                <Link to={toRelativePath(forgotMutation.data.resetUrl)}
                      className="text-accent hover:underline">
                  {forgotMutation.data.resetUrl}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-text-2 text-sm mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="j.reyes@msc.edu"
                autoComplete="email"
                required
                className="cb-input"
              />
            </div>

            {forgotMutation.isError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg
                              px-3 py-2 text-danger text-sm">
                {forgotMutation.error?.message || 'Something went wrong'}
              </div>
            )}

            <button
              type="submit"
              disabled={forgotMutation.isPending}
              className="w-full bg-accent hover:bg-accent/90 text-white
                         font-medium py-2.5 rounded-lg transition-colors
                         flex items-center justify-center gap-2
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {forgotMutation.isPending
                ? <><Spinner /> Sending...</>
                : 'Send reset link →'
              }
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-text-2 text-sm">
        Remembered your password?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white/30 border-t-white
                    rounded-full animate-spin" />
  )
}
