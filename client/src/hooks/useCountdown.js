import { useState, useEffect } from 'react'

export function useCountdown(expiresAt) {
  const getRemaining = () => {
    if (!expiresAt) return 0
    return Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))
  }

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => {
      const r = getRemaining()
      setRemaining(r)
      if (r <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return {
    minutes,
    seconds,
    expired:   remaining <= 0,
    formatted: `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`,
    urgent:    remaining < 300,  // last 5 minutes
  }
}
