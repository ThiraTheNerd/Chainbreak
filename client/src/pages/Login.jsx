import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Link2Off, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/services/api'

export function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)

  const loginMutation = useMutation({
    mutationFn: (credentials) => api.post('/auth/login', credentials)
                                    .then(r => r.data),
    onSuccess: ({ user, token }) => {
      login(user, token)
      navigate('/dashboard', { replace: true })
    },
  })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    loginMutation.mutate({ email, password })
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
        <p className="text-text-2 text-sm">
          Master the full attack kill chain
        </p>
      </div>
      <div className="w-full max-w-sm bg-surface border border-border
                      rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-1 text-xl font-medium">Sign in</h1>
          <span className="text-text-3 text-xs font-mono">v1.0.0</span>
        </div>

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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-2 text-sm">Password</label>
              <Link
                to="/forgot-password"
                className="text-accent text-sm hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="cb-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-text-3 hover:text-text-2 transition-colors"
                tabIndex={-1}
              >
                {showPw
                  ? <EyeOff size={16} />
                  : <Eye    size={16} />
                }
              </button>
            </div>
          </div>
          {loginMutation.isError && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg
                            px-3 py-2 text-danger text-sm">
              {loginMutation.error?.message || 'Login failed'}
            </div>
          )}
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-accent hover:bg-accent/90 text-white
                       font-medium py-2.5 rounded-lg transition-colors
                       flex items-center justify-center gap-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loginMutation.isPending
              ? <><Spinner /> Signing in...</>
              : 'Sign in →'
            }
          </button>
        </form>
      </div>
      <p className="mt-4 text-text-2 text-sm">
        Don't have an account?{' '}
        <Link to="/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
      <div className="flex items-center gap-3 mt-8">
        {['OWASP Top 10', 'Docker security', 'AWS cloud'].map(label => (
          <span
            key={label}
            className="px-3 py-1 rounded-full border border-border bg-surface
                       text-text-3 text-xs font-mono"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-4">
        <div className="w-1.5 h-1.5 rounded-full bg-success" />
        <span className="text-text-3 text-xs font-mono">
          secure.tls · session encrypted end-to-end
        </span>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white/30 border-t-white
                    rounded-full animate-spin" />
  )
}
