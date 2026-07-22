import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { budgetService } from '../services/budgetService'
import { useAuth } from '../context/AuthContext'
import { can } from '../utils/permissions'
import { projectService } from '../services/projectService'

const CATEGORIES = ['Personnel','Infrastructure','Tooling','Vendor','Training','Marketing','Operations','Other']

const EMPTY = {
  project_id: '', project_name: '', category: 'Personnel',
  description: '', planned_amount: '', actual_amount: '', entry_date: ''
}

function SummaryCard({ title, value, sub, color, bg }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{title}</Typography>
      <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  )
}

export default function Budget() {
  const { user } = useAuth()
  const [data, setData] = useState({ entries: [], summary: { total_planned: 0, total_actual: 0 } })
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: EMPTY })
  const [delConfirm, setDelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [touched, setTouched] = useState({})

  useEffect(() => {
    projectService.getAll().then(setProjects).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterProject) params.project_id = filterProject
      setData(await budgetService.getAll(params))
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filterProject])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setTouched({}); setDialog({ open: true, mode: 'create', data: EMPTY }) }
  const openEdit   = (e) => { setTouched({}); setDialog({
    open: true, mode: 'edit',
    data: { ...e, entry_date: e.entry_date?.split('T')[0] || '' }
  }) }
  const closeDialog = () => setDialog(d => ({ ...d, open: false }))

  // ── Validation ──────────────────────────────────────────────
  const validate = (d) => {
    const errs = {}
    if (!d.project_id) errs.project_id = 'Project is required'
    if (!d.category) errs.category = 'Category is required'
    if (d.planned_amount === '' || d.planned_amount === null) errs.planned_amount = 'Planned amount is required'
    else if (Number(d.planned_amount) < 0) errs.planned_amount = 'Cannot be negative'
    if (d.actual_amount !== '' && Number(d.actual_amount) < 0) errs.actual_amount = 'Cannot be negative'
    if (!d.entry_date) errs.entry_date = 'Date is required'
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => touched[field] && errors[field]

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data }
      if (payload.project_id) {
        const proj = projects.find(p => p.id === payload.project_id)
        if (proj) payload.project_name = proj.name
      }
      if (dialog.mode === 'create') {
        await budgetService.create(payload)
        setSnack({ open: true, msg: 'Entry created', sev: 'success' })
      } else {
        await budgetService.update(dialog.data.id, payload)
        setSnack({ open: true, msg: 'Entry updated', sev: 'success' })
      }
      closeDialog()
      load()
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await budgetService.remove(delConfirm.id)
      setSnack({ open: true, msg: 'Entry deleted', sev: 'success' })
      setDelConfirm(null)
      load()
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    }
  }

  const f = (field) => (e) => {
    setTouched(t => ({ ...t, [field]: true }))
    setDialog(d => ({ ...d, data: { ...d.data, [field]: e.target.value } }))
  }

  const entries = data.entries || []
  const summary = data.summary || { total_planned: 0, total_actual: 0 }
  const planned = Number(summary.total_planned)
  const actual  = Number(summary.total_actual)
  const variance = planned - actual
  const usedPct  = planned > 0 ? Math.round((actual / planned) * 100) : 0

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Budget</Typography>
          <Typography variant="body2" color="text.secondary">{entries.length} entries</Typography>
        </Box>
        {can(user, 'budget:create') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            New Entry
          </Button>
        )}
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="Total Planned" value={`$${planned.toLocaleString()}`} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard title="Total Actual" value={`$${actual.toLocaleString()}`} color="#5B21B6" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Variance"
            value={`${variance >= 0 ? '+' : ''}$${variance.toLocaleString()}`}
            color={variance >= 0 ? '#166534' : '#991B1B'}
            sub={variance >= 0 ? 'Under budget' : 'Over budget'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Budget Used</Typography>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>{usedPct}%</Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(usedPct, 100)}
              sx={{
                mt: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: usedPct > 90 ? '#DC2626' : usedPct > 70 ? '#D97706' : '#16A34A',
                  borderRadius: 3
                }
              }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Filter */}
      <Box sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Project</InputLabel>
          <Select label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <MenuItem value="">All projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Planned ($)</TableCell>
                <TableCell align="right">Actual ($)</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}</TableRow>
                  ))
                : entries.length === 0
                ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>No budget entries. Add your first entry!</TableCell></TableRow>
                : entries.map(e => {
                    const v = Number(e.planned_amount) - Number(e.actual_amount)
                    return (
                      <TableRow key={e.id} hover>
                        <TableCell>
                          <Chip label={e.category} size="small" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{e.description || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.82rem' }}>{e.project_name || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {e.entry_date ? new Date(e.entry_date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          ${Number(e.planned_amount).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                          ${Number(e.actual_amount).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            {v >= 0
                              ? <TrendingUpIcon sx={{ fontSize: 14, color: '#16A34A' }} />
                              : <TrendingDownIcon sx={{ fontSize: 14, color: '#DC2626' }} />
                            }
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ color: v >= 0 ? '#16A34A' : '#DC2626' }}
                            >
                              {v >= 0 ? '+' : ''}${v.toLocaleString()}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {can(user, 'budget:edit') && (
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(e)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                          {can(user, 'budget:delete') && (
                            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDelConfirm(e)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{dialog.mode === 'create' ? 'New Budget Entry' : 'Edit Entry'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!showErr('project_id')}>
                <InputLabel>Project *</InputLabel>
                <Select label="Project *" value={dialog.data.project_id} onChange={f('project_id')}>
                  {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category *</InputLabel>
                <Select label="Category *" value={dialog.data.category} onChange={f('category')}>
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Date *" value={dialog.data.entry_date} onChange={f('entry_date')} InputLabelProps={{ shrink: true }}
                error={!!showErr('entry_date')} helperText={showErr('entry_date') || ''} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={dialog.data.description} onChange={f('description')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Planned amount ($) *" value={dialog.data.planned_amount} onChange={f('planned_amount')} inputProps={{ min: 0 }}
                error={!!showErr('planned_amount')} helperText={showErr('planned_amount') || ''} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Actual amount ($)" value={dialog.data.actual_amount} onChange={f('actual_amount')} inputProps={{ min: 0 }}
                error={!!showErr('actual_amount')} helperText={showErr('actual_amount') || ''} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !isValid}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onClose={() => setDelConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Delete entry?</DialogTitle>
        <DialogContent><Typography>This budget entry will be permanently deleted.</Typography></DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDelConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none' }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
