import api from './api'

const BASE = '/budget'

function ensureShape(data, label) {
  if (!data || !Array.isArray(data.entries)) {
    console.error(`[budgetService] Expected {entries, summary} from ${label}, got:`, data)
    return { entries: [], summary: { total_planned: 0, total_actual: 0 } }
  }
  return data
}

export const budgetService = {
  getAll: (params = {}) =>
    api.get(BASE, { params }).then(r => ensureShape(r.data, 'GET /budget')),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create:  (data) => api.post(BASE, data).then(r => r.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  remove:  (id) => api.delete(`${BASE}/${id}`).then(r => r.data),
}