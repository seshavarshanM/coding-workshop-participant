import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Demo accounts — replace with a real /api/auth endpoint later
const DEMO_USERS = [
  { id: '1', name: 'Alice Admin',   email: 'admin@acme.com',   role: 'admin'   },
  { id: '2', name: 'Mike Manager',  email: 'manager@acme.com', role: 'manager' },
  { id: '3', name: 'Sam Member',    email: 'member@acme.com',  role: 'member'  },
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = sessionStorage.getItem('acme_user')
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })

  const login = (email, password) => {
    const found = DEMO_USERS.find(u => u.email === email.trim().toLowerCase())
    if (found && password === 'password') {
      sessionStorage.setItem('acme_user', JSON.stringify(found))
      setUser(found)
      return { success: true }
    }
    return { success: false, message: 'Invalid email or password' }
  }

  const logout = () => {
    sessionStorage.removeItem('acme_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
