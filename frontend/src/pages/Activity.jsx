import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import { peopleService } from '../services/peopleService'
import { budgetService } from '../services/budgetService'
import { useAuth } from '../context/AuthContext'

const ACTION_STYLE = {
  create:  { bg: '#DCFCE7', color: '#166534', label: 'Created' },
  update:  { bg: '#DBEAFE', color: '#1E40AF', label: 'Updated' },
  delete:  { bg: '#FEE2E2', color: '#991B1B', label: 'Deleted' },
  propose: { bg: '#EDE9FE', color: '#5B21B6', label: 'Proposed' },
  hire:    { bg: '#FEF3C7', color: '#92400E', label: 'Hired' },
}

const ENTITY_LABEL = {
  project: 'Project',
  deliverable: 'Deliverable',
  budget_entry: 'Budget entry',
  person: 'Person',
}

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const avatarColor = (n = '') => {
  const c = ['#1565C0', '#7C3AED', '#065F46', '#9A3412', '#1E40AF', '#6B21A8']
  return c[(n.charCodeAt(0) || 0) % c.length]
}

function timeAgo(ts) {
  if (!ts) return '—'
  const then = new Date(ts.replace(' ', 'T'))
  const mins = Math.round((Date.now() - then.getTime()) / 60000)
  if (Number.isNaN(mins)) return ts
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return then.toLocaleDateString()
}

export default function Activity() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [removedBudget, setRemovedBudget] = useState([])
  const [entityFilter, setEntityFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (entityFilter) params.entity_type = entityFilter
      const [log, deleted] = await Promise.all([
        peopleService.audit(params),
        budgetService.deleted().catch(() => []),
      ])
      setEntries(log)
      setRemovedBudget(Array.isArray(deleted) ? deleted : [])
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }, [entityFilter])

  useEffect(() => { load() }, [load])

  const scopeNote = user?.role === 'admin'
    ? 'Every recorded action across the platform.'
    : 'Actions you have taken. Administrators can see the full trail.'

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Activity Log</Typography>
        <Typography variant="body2" color="text.secondary">{scopeNote}</Typography>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Recorded actions</Typography>
            <Typography variant="h5" fontWeight={800}>{loading ? '—' : entries.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Deletions</Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#991B1B' }}>
              {loading ? '—' : entries.filter(e => e.action === 'delete').length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Budget entries removed</Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#92400E' }}>
              {loading ? '—' : removedBudget.length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <TextField
        select size="small" label="Filter by type"
        value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
        sx={{ mb: 2, minWidth: 220 }}
      >
        <MenuItem value="">All activity</MenuItem>
        <MenuItem value="project">Projects</MenuItem>
        <MenuItem value="deliverable">Deliverables</MenuItem>
        <MenuItem value="budget_entry">Budget entries</MenuItem>
        <MenuItem value="person">People</MenuItem>
      </TextField>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Who</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Item</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}</TableRow>
                  ))
                : entries.length === 0
                ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No activity recorded yet.
                  </TableCell></TableRow>
                : entries.map(e => {
                    const a = ACTION_STYLE[e.action] || { bg: '#F1F5F9', color: '#475569', label: e.action }
                    return (
                      <TableRow key={e.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 26, height: 26, fontSize: '0.68rem', fontWeight: 700,
                              bgcolor: avatarColor(e.actor_name) }}>
                              {initials(e.actor_name)}
                            </Avatar>
                            <Box>
                              <Typography fontSize="0.83rem" fontWeight={600} lineHeight={1.2}>
                                {e.actor_name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary"
                                sx={{ textTransform: 'capitalize' }}>
                                {e.actor_role}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={a.label} size="small"
                            sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22, bgcolor: a.bg, color: a.color }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {ENTITY_LABEL[e.entity_type] || e.entity_type}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.83rem', fontWeight: 500 }}>
                          {e.entity_label || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {e.project_name || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {timeAgo(e.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Removed budget entries are retained rather than erased */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography fontWeight={700}>Removed budget entries ({removedBudget.length})</Typography>
          <Typography variant="caption" color="text.secondary">
            Financial records are retained after removal so spending history stays attributable.
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Project</TableCell>
                <TableCell align="right">Planned ($)</TableCell>
                <TableCell>Removed by</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {removedBudget.length === 0
                ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No budget entries have been removed.
                  </TableCell></TableRow>
                : removedBudget.map(e => (
                    <TableRow key={e.id} hover>
                      <TableCell>
                        <Chip label={e.category} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{e.description || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem' }}>{e.project_name || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.83rem', fontWeight: 600 }}>
                        ${Number(e.planned_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.83rem', fontWeight: 600 }}>{e.deleted_by || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {timeAgo(e.deleted_at)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
