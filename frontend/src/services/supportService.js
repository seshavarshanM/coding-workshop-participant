import api from './api'

const BASE = '/support'

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    console.error(`[supportService] Expected array from ${label}, got:`, data)
    return []
  }
  return data
}

export const supportService = {
  getAll:  (params = {}) => api.get(BASE, { params }).then(r => ensureArray(r.data, 'GET /support')),
  getById: (id)          => api.get(`${BASE}/${id}`).then(r => r.data),
  create:  (data)        => api.post(BASE, data).then(r => r.data),
  update:  (id, data)    => api.put(`${BASE}/${id}`, data).then(r => r.data),

  stats:   ()            => api.get(`${BASE}/stats`).then(r => r.data),
  replies: (id)          => api.get(`${BASE}/${id}/replies`).then(r => ensureArray(r.data, 'GET replies')),
  reply:   (id, message) => api.post(`${BASE}/${id}/replies`, { message }).then(r => r.data),
}
