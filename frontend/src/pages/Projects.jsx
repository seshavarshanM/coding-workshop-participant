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
import TableSortLabel from '@mui/material/TableSortLabel'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { projectService } from '../services/projectService'
import { peopleService } from '../services/peopleService'
import { useAuth } from '../context/AuthContext'
import { can, canEditProject, canDeleteProject, ADMIN_READONLY_NOTE } from '../utils/permissions'
import { isAtRisk, riskReason } from '../utils/risk'
import StatusChip from '../components/StatusChip'
import PageHeader from '../components/PageHeader'

const EMPTY_FORM = {
  name: '', description: '', status: 'planning', department: '',
  manager: '', start_date: '', end_date: '',
  budget_planned: '', priority: 'medium',
}

export default function Projects() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  // Managers open on their own work; admins oversee everything, so they open on all.
  const [tab, setTab] = useState(() => (user?.role === 'manager' ? 'mine' : 'all'))
  const [people, setPeople] = useState([])
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
  useEffect(() => { peopleService.getAll().then(setPeople).catch(() => {}) }, [])

  const PRIORITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 }
  const toggleSort = (field) => setSort(s =>
    s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })

  const mineCount   = projects.filter(p => p.manager === user?.name).length
  const riskCount    = projects.filter(isAtRisk).length
  const scoped = tab === 'mine'
    ? projects.filter(p => p.manager === user?.name)
    : tab === 'risk'
    ? projects.filter(isAtRisk)
    : projects

  const sorted = [...scoped].sort((a, b) => {
    if (!sort.field) return 0
    let av, bv
    switch (sort.field) {
      case 'name':     av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); break
      case 'status':   av = a.status || ''; bv = b.status || ''; break
      case 'priority': av = PRIORITY_ORDER[a.priority] ?? 0; bv = PRIORITY_ORDER[b.priority] ?? 0; break
      case 'manager':  av = (a.manager || '').toLowerCase(); bv = (b.manager || '').toLowerCase(); break
      case 'progress': av = Number(a.completion_percentage || 0); bv = Number(b.completion_percentage || 0); break
      case 'budget':   av = Number(a.budget_planned || 0); bv = Number(b.budget_planned || 0); break
      case 'end_date': av = a.end_date || '9999'; bv = b.end_date || '9999'; break
      default: return 0
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const managerLocked = user?.role === 'manager'

  const openCreate = () => { setTouched({}); setDialog({
    open: true, mode: 'create',
    data: { ...EMPTY_FORM, manager: managerLocked ? user.name : '' }
  }) }
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
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Every initiative, who owns it, and whether it is on track."
        action={
        can(user, 'project:create') ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New project
          </Button>
        ) : null}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
        {user?.role === 'manager' && <Tab value="mine" label={`My projects (${mineCount})`} />}
        <Tab value="all" label={`All projects (${projects.length})`} />
        <Tab value="risk" label={`Needs attention (${riskCount})`} />
      </Tabs>

      {user?.role === 'admin' && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>{ADMIN_READONLY_NOTE}</Alert>
      )}

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
                <TableCell sortDirection={sort.field === 'name' ? sort.dir : false}>
                  <TableSortLabel active={sort.field === 'name'} direction={sort.field === 'name' ? sort.dir : 'asc'} onClick={() => toggleSort('name')}>Project</TableSortLabel>
                </TableCell>
                <TableCell><TableSortLabel active={sort.field === 'status'} direction={sort.field === 'status' ? sort.dir : 'asc'} onClick={() => toggleSort('status')}>Status</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sort.field === 'priority'} direction={sort.field === 'priority' ? sort.dir : 'asc'} onClick={() => toggleSort('priority')}>Priority</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sort.field === 'manager'} direction={sort.field === 'manager' ? sort.dir : 'asc'} onClick={() => toggleSort('manager')}>Manager</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sort.field === 'progress'} direction={sort.field === 'progress' ? sort.dir : 'asc'} onClick={() => toggleSort('progress')}>Progress</TableSortLabel></TableCell>
                <TableCell align="right"><TableSortLabel active={sort.field === 'budget'} direction={sort.field === 'budget' ? sort.dir : 'asc'} onClick={() => toggleSort('budget')}>Budget Planned</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sort.field === 'end_date'} direction={sort.field === 'end_date' ? sort.dir : 'asc'} onClick={() => toggleSort('end_date')}>End Date</TableSortLabel></TableCell>
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
                : sorted.map(p => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.department}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StatusChip value={p.status} />
                          {isAtRisk(p) && p.status !== 'at_risk' && (
                            <Tooltip title={`Auto-flagged: ${riskReason(p)}`}>
                              <ReportProblemIcon sx={{ fontSize: 16, color: '#D97706' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
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
                        {canEditProject(user, p) && (
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                        {canDeleteProject(user) && (
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDelConfirm(p)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        )}
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
              <TextField fullWidth select label="Manager *" value={dialog.data.manager} onChange={f('manager')}
                disabled={managerLocked}
                error={!!showErr('manager')}
                helperText={showErr('manager') || (managerLocked ? 'Projects you create are owned by you' : '')}>
                {people.filter(pp => pp.role === 'manager' || pp.role === 'admin').length === 0 && (
                  <MenuItem disabled value="">No managers found</MenuItem>
                )}
                {people.filter(pp => pp.role === 'manager' || pp.role === 'admin').map(pp => (
                  <MenuItem key={pp.id} value={pp.name}>
                    {pp.name} · {pp.title || pp.role}
                  </MenuItem>
                ))}
              </TextField>
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
              <Grid item xs={12}>
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  Completion is calculated automatically from this project's deliverables.
                </Alert>
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
