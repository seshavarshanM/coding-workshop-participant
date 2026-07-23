import api from './api'

const BASE = '/people'

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    console.error(`[peopleService] Expected array from ${label}, got:`, data)
    return []
  }
  return data
}

export const peopleService = {
  getAll:  (params = {}) => api.get(BASE, { params }).then(r => ensureArray(r.data, 'GET /people')),
  getById: (id)          => api.get(`${BASE}/${id}`).then(r => r.data),
  create:  (data)        => api.post(BASE, data).then(r => r.data),
  update:  (id, data)    => api.put(`${BASE}/${id}`, data).then(r => r.data),
  remove:  (id)          => api.delete(`${BASE}/${id}`).then(r => r.data),

  // Auth
  login:   (email, password) =>
    api.post(`${BASE}/login`, { email, password }).then(r => r.data),
  seed:    () => api.post(`${BASE}/seed`).then(r => r.data),

  // Activity trail — admins see all actions, managers see their own.
  audit:   (params = {}) =>
    api.get(`${BASE}/audit`, { params }).then(r => ensureArray(r.data, 'GET /people/audit')),
}
