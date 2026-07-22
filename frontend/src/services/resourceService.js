import api from './api'

const BASE = '/resources'

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    console.error(`[resourceService] Expected array from ${label}, got:`, data)
    return []
  }
  return data
}

export const resourceService = {
  getAll: (params = {}) =>
    api.get(BASE, { params }).then(r => ensureArray(r.data, 'GET /resources')),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create:  (data) => api.post(BASE, data).then(r => r.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  remove:  (id) => api.delete(`${BASE}/${id}`).then(r => r.data),
}