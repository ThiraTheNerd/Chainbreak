import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Link2Off, Eye, EyeOff } from 'lucide-react'
import api from '@/services/api'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword]  = useState('')
  const [showPw,          setShowPw]           = useState(false)
  const [mismatch,        setMismatch]         = useState(false)

  const resetMutation = useMutation({
    mutationFn: (data) => api.post('/auth/reset-password', data).then(r => r.data),
    onSuccess: () => {
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!password || !confirmPassword) return
    if (password !== confirmPassword) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    resetMutation.mutate({ token, password })
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
        <p className="text-text-2 text-sm">Choose a new password</p>
      </div>

      <div className="w-full max-w-sm bg-surface border border-border
                      rounded-xl p-8">
        <h1 className="text-text-1 text-xl font-medium mb-6">
          Reset password
        </h1>

        {!token ? (
          <div className="bg-danger/10 border border-danger/30 rounded-lg
                          px-3 py-2 text-danger text-sm">
            This reset link is missing its token. Please request a new one.
          </div>
        ) : resetMutation.isSuccess ? (
          <div className="bg-success/10 border border-success/30 rounded-lg
                          px-3 py-2 text-success text-sm">
            Your password has been reset. Redirecting to sign in...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-text-2 text-sm mb-1.5 block">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="cb-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-text-3 hover:text-text-2 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-text-2 text-sm mb-1.5 block">
                Confirm password
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                minLength={8}
                className="cb-input"
              />
            </div>

            {mismatch && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg
                              px-3 py-2 text-danger text-sm">
                Passwords do not match
              </div>
            )}

            {resetMutation.isError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg
                              px-3 py-2 text-danger text-sm">
                {resetMutation.error?.message || 'Password reset failed'}
              </div>
            )}

            <button
              type="submit"
              disabled={resetMutation.isPending}
              className="w-full bg-accent hover:bg-accent/90 text-white
                         font-medium py-2.5 rounded-lg transition-colors
                         flex items-center justify-center gap-2
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resetMutation.isPending
                ? <><Spinner /> Resetting...</>
                : 'Reset password →'
              }
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-text-2 text-sm">
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
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
