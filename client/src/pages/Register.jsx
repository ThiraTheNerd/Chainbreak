import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Link2Off, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/services/api'

export function Register() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [form,   setForm]   = useState({ username: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data).then(r => r.data),
    onSuccess: ({ user, token }) => {
      login(user, token)
      navigate('/dashboard', { replace: true })
    },
  })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) return
    registerMutation.mutate(form)
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
        <p className="text-text-2 text-sm">Create your account</p>
      </div>

      <div className="w-full max-w-sm bg-surface border border-border
                      rounded-xl p-8">
        <h1 className="text-text-1 text-xl font-medium mb-6">
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-text-2 text-sm mb-1.5 block">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={update('username')}
              placeholder="j.reyes"
              required
              minLength={3}
              maxLength={20}
              className="cb-input"
            />
          </div>

          <div>
            <label className="text-text-2 text-sm mb-1.5 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="j.reyes@msc.edu"
              required
              className="cb-input"
            />
          </div>

          <div>
            <label className="text-text-2 text-sm mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={update('password')}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="cb-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-text-3 hover:text-text-2"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {registerMutation.isError && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg
                            px-3 py-2 text-danger text-sm">
              {registerMutation.error?.message || 'Registration failed'}
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full bg-accent hover:bg-accent/90 text-white
                       font-medium py-2.5 rounded-lg transition-colors
                       flex items-center justify-center gap-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {registerMutation.isPending
              ? <><div className="w-4 h-4 border-2 border-white/30
                                   border-t-white rounded-full animate-spin"/>
                  Creating account...</>
              : 'Create account →'
            }
          </button>
        </form>
      </div>

      <p className="mt-4 text-text-2 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>

      <div className="flex items-center gap-3 mt-8">
        {['OWASP Top 10', 'Docker security', 'AWS cloud'].map(label => (
          <span key={label}
            className="px-3 py-1 rounded-full border border-border bg-surface
                       text-text-3 text-xs font-mono">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
