import { createContext, useContext, useState } from 'react'
import { peopleService } from '../services/peopleService'

const AuthContext = createContext(null)

const STORAGE_KEY = 'acme_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // The token is attached per-request by an interceptor in services/api.js,
  // which reads it from sessionStorage. That avoids a race on first paint:
  // child components fire their data effects before a provider effect runs.

  /** Authenticates against the backend; password is verified with bcrypt server-side. */
  const login = async (email, password) => {
    try {
      const data = await peopleService.login(email, password)
      const next = { token: data.token, user: data.user }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSession(next)
      return { success: true }
    } catch (err) {
      const message =
        err?.response?.status === 401
          ? 'Invalid email or password'
          : err?.response?.data?.message || 'Could not reach the server. Is the backend running?'
      return { success: false, message }
    }
  }

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  /** Refresh the cached profile (e.g. after the user edits their own details). */
  const refreshUser = async () => {
    if (!session?.user?.id) return
    try {
      const fresh = await peopleService.getById(session.user.id)
      const next = { ...session, user: fresh }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSession(next)
    } catch {
      /* non-fatal */
    }
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user || null, token: session?.token || null, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
