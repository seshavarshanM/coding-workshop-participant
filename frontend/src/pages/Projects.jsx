import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
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
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import { projectService } from '../services/projectService'
import StatusChip from '../components/StatusChip'

const EMPTY_FORM = {
  name: '', description: '', status: 'planning', department: '',
  manager: '', start_date: '', end_date: '',
  budget_planned: '', priority: 'medium',
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: EMPTY_FORM })
  const [delConfirm, setDelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [touched, setTouched] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      setProjects(await projectService.getAll(params))
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setTouched({}); setDialog({ open: true, mode: 'create', data: EMPTY_FORM }) }
  const openEdit   = (p) => { setTouched({}); setDialog({
    open: true, mode: 'edit',
    data: { ...p, start_date: p.start_date?.split('T')[0] || '', end_date: p.end_date?.split('T')[0] || '' }
  }) }
  const closeDialog = () => setDialog(d => ({ ...d, open: false }))

  // ── Validation ──────────────────────────────────────────────
  const validate = (d) => {
    const errs = {}
    if (!d.name?.trim()) errs.name = 'Project name is required'
    if (!d.manager?.trim()) errs.manager = 'Manager is required'
    if (!d.department?.trim()) errs.department = 'Department is required'
    if (!d.start_date) errs.start_date = 'Start date is required'
    if (!d.end_date) errs.end_date = 'End date is required'
    if (d.start_date && d.end_date && d.end_date <= d.start_date)
      errs.end_date = 'End date must be after start date'
    if (d.budget_planned === '' || d.budget_planned === null)
      errs.budget_planned = 'Planned budget is required'
    else if (Number(d.budget_planned) < 0)
      errs.budget_planned = 'Budget cannot be negative'
    if (d.completion_percentage !== undefined && d.completion_percentage !== '' &&
        (Number(d.completion_percentage) < 0 || Number(d.completion_percentage) > 100))
      errs.completion_percentage = 'Must be between 0 and 100'
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => touched[field] && errors[field]

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.mode === 'create') {
        await projectService.create(dialog.data)
        setSnack({ open: true, msg: 'Project created', sev: 'success' })
      } else {
        await projectService.update(dialog.data.id, dialog.data)
        setSnack({ open: true, msg: 'Project updated', sev: 'success' })
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
      await projectService.remove(delConfirm.id)
      setSnack({ open: true, msg: 'Project deleted', sev: 'success' })
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
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Projects</Typography>
          <Typography variant="body2" color="text.secondary">{projects.length} total</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          New Project
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          }}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All statuses</MenuItem>
            {['planning','active','at_risk','on_hold','completed'].map(s => (
              <MenuItem key={s} value={s}><StatusChip value={s} /></MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Project</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell align="right">Budget Planned</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton variant="text" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : projects.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        No projects found. Create your first project!
                      </TableCell>
                    </TableRow>
                  )
                : projects.map(p => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.department}</Typography>
                      </TableCell>
                      <TableCell><StatusChip value={p.status} /></TableCell>
                      <TableCell><StatusChip value={p.priority} /></TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{p.manager || '—'}</TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={p.completion_percentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }}
                          />
                          <Typography variant="caption">{p.completion_percentage || 0}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                        ${Number(p.budget_planned || 0).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                        {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Open"><IconButton size="small" onClick={() => navigate(`/projects/${p.id}`)}><OpenInNewIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDelConfirm(p)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create / Edit dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialog.mode === 'create' ? 'New Project' : 'Edit Project'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Project name *" value={dialog.data.name} onChange={f('name')}
                error={!!showErr('name')} helperText={showErr('name') || ''} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={dialog.data.description} onChange={f('description')} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={dialog.data.status} onChange={f('status')}>
                  {['planning','active','at_risk','on_hold','completed'].map(s => (
                    <MenuItem key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={dialog.data.priority} onChange={f('priority')}>
                  {['low','medium','high','critical'].map(s => (
                    <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Department *" value={dialog.data.department} onChange={f('department')}
                error={!!showErr('department')} helperText={showErr('department') || ''} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Manager *" value={dialog.data.manager} onChange={f('manager')}
                error={!!showErr('manager')} helperText={showErr('manager') || ''} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Start date *" value={dialog.data.start_date} onChange={f('start_date')} InputLabelProps={{ shrink: true }}
                error={!!showErr('start_date')} helperText={showErr('start_date') || ''} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="End date *" value={dialog.data.end_date} onChange={f('end_date')} InputLabelProps={{ shrink: true }}
                error={!!showErr('end_date')} helperText={showErr('end_date') || ''} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Budget planned ($) *" value={dialog.data.budget_planned} onChange={f('budget_planned')} inputProps={{ min: 0 }}
                error={!!showErr('budget_planned')} helperText={showErr('budget_planned') || ''} />
            </Grid>
            {dialog.mode === 'edit' && (
              <Grid item xs={6}>
                <TextField fullWidth type="number" label="Completion (%)" value={dialog.data.completion_percentage} onChange={f('completion_percentage')} inputProps={{ min: 0, max: 100 }}
                  error={!!showErr('completion_percentage')} helperText={showErr('completion_percentage') || ''} />
              </Grid>
            )}
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
        <DialogTitle fontWeight={700}>Delete project?</DialogTitle>
        <DialogContent>
          <Typography>
            "{delConfirm?.name}" will be permanently deleted. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDelConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
