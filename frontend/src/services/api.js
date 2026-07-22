import axios from 'axios'

// The proxy server routes everything under /api/{endpoint}.
const RAW = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const BASE_URL = RAW.endsWith('/api') ? RAW : `${RAW.replace(/\/$/, '')}/api`

// DEBUG — remove later. Confirms what base URL is actually used.

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

export default api