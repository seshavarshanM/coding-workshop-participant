import axios from 'axios'

// The proxy routes everything under /api/{endpoint}; normalise either form.
const RAW = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const BASE_URL = RAW.endsWith('/api') ? RAW : `${RAW.replace(/\/$/, '')}/api`

const STORAGE_KEY = 'acme_session'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

function readToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw)?.token || null : null
  } catch {
    return null
  }
}

/**
 * Attach the JWT at request time.
 *
 * Reading from sessionStorage here (rather than setting a default header in a
 * React effect) avoids a race on first paint: child components fire their data
 * effects before a provider effect runs.
 *
 * The token is sent twice on purpose. Lambda Function URLs reserve the standard
 * `Authorization` header for IAM signature verification and can consume it
 * before the function sees it, so `X-Auth-Token` carries a copy that survives.
 */
api.interceptors.request.use(config => {
  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    config.headers['X-Auth-Token'] = token
  }
  return config
})

/**
 * A 401 means the session is missing or expired.
 *
 * Only sign the user out when we actually had a token — otherwise a single
 * unauthenticated call could bounce someone straight back to the login screen
 * and hide the real error.
 */
api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    const isAuthCall = url.includes('/login')

    if (status === 401 && !isAuthCall) {
      const hadToken = !!readToken()
      console.warn('[api] 401 on', url, hadToken ? '(session rejected — signing out)' : '(no session)')
      if (hadToken) {
        sessionStorage.removeItem(STORAGE_KEY)
        if (!window.location.pathname.startsWith('/login')) {
          window.location.replace('/login')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
