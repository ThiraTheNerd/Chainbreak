import { createContext, useState, useEffect, useCallback } from 'react'
import api, { setAuthToken, clearAuthToken } from '@/services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]    = useState(null)
  const [token, setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = sessionStorage.getItem('cb_token')
    if (!savedToken) {
      setLoading(false)
      return
    }
    const cachedUser = JSON.parse(sessionStorage.getItem('cb_user') || 'null')
    // GET /auth/me only returns { id, role }, so merge onto the cached user
    // rather than overwrite (loses username/email).
    setAuthToken(savedToken)
    api.get('/auth/me')
      .then(({ data }) => {
        setUser({ ...cachedUser, ...data.user })
        setToken(savedToken)
      })
      .catch(() => {
        sessionStorage.removeItem('cb_token')
        sessionStorage.removeItem('cb_user')
        clearAuthToken()
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback((userData, jwt) => {
    setUser(userData)
    setToken(jwt)
    setAuthToken(jwt)
    sessionStorage.setItem('cb_token', jwt)
    sessionStorage.setItem('cb_user', JSON.stringify(userData))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    clearAuthToken()
    sessionStorage.removeItem('cb_token')
    sessionStorage.removeItem('cb_user')
    // Do not call /api/auth/logout here — the backend just clears the cookie.
    // Token expiry handles invalidation.
  }, [])

  const value = { user, token, login, logout, isAuthenticated: !!token }

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AppLoadingScreen /> : children}
    </AuthContext.Provider>
  )
}

function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent
                        rounded-full animate-spin" />
        <span className="text-text-2 text-sm">Loading ChainBreak...</span>
      </div>
    </div>
  )
}
