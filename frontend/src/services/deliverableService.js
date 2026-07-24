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

  // Progress timeline — who moved the work, how far, and why.
  updates:    (id)       => api.get(`${BASE}/${id}/updates`).then(r => Array.isArray(r.data) ? r.data : []),
  postUpdate: (id, note) => api.post(`${BASE}/${id}/updates`, { note }).then(r => r.data),

  // What has happened that this person should know about — derived from the
  // timeline, scoped by role on the server.
  notifications: () => api.get(`${BASE}/notifications`).then(r => Array.isArray(r.data) ? r.data : []),
}