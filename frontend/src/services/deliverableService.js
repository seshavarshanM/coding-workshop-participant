import api from './api'

const BASE = '/deliverables'

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    console.error(`[deliverableService] Expected array from ${label}, got:`, data)
    return []
  }
  return data
}

export const deliverableService = {
  getAll: (params = {}) =>
    api.get(BASE, { params }).then(r => ensureArray(r.data, 'GET /deliverables')),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create:  (data) => api.post(BASE, data).then(r => r.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  remove:  (id) => api.delete(`${BASE}/${id}`).then(r => r.data),
}