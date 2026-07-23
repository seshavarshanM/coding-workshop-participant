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
import PageHeader from '../components/PageHeader'
import ProjectGroupCard from '../components/ProjectGroupCard'
import { statusToken, palette } from '../theme/tokens'
import { useAuth } from '../context/AuthContext'
import { can, canEditBudgetEntry, canDeleteBudgetEntry, ADMIN_READONLY_NOTE } from '../utils/permissions'
import { projectService } from '../services/projectService'

const money = n => `$${Number(n || 0).toLocaleString()}`

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
    else {
      const proj = projects.find(p => p.id === d.project_id)
      if (proj?.start_date && d.entry_date < proj.start_date.split('T')[0])
        errs.entry_date = `Cannot be before the project starts (${new Date(proj.start_date).toLocaleDateString()})`
      else if (proj?.end_date && d.entry_date > proj.end_date.split('T')[0])
        errs.entry_date = `Cannot be after the project deadline (${new Date(proj.end_date).toLocaleDateString()})`
    }
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => touched[field] && errors[field]


  // Managers may only record budget against projects they manage.
  const assignableProjects = projects.filter(
    p => user?.role === 'admin' || p.manager === user?.name
  )

  // ── Tier A: warn if this project's planned entries would exceed its budget ceiling ──
  const selectedProject = projects.find(p => p.id === dialog.data.project_id)
  const ceiling = selectedProject ? Number(selectedProject.budget_planned || 0) : 0
  const existingPlanned = (data.entries || [])
    .filter(e => e.project_id === dialog.data.project_id && e.id !== dialog.data.id)
    .reduce((s, e) => s + Number(e.planned_amount || 0), 0)
  const projectedTotal = existingPlanned + Number(dialog.data.planned_amount || 0)
  const overCeiling = ceiling > 0 && projectedTotal > ceiling

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

  // Entries grouped under their project, with plan-vs-actual per project.
  const groupedByProject = (() => {
    const map = new Map()
    for (const e of entries) {
      const key = e.project_id || 'unassigned'
      if (!map.has(key)) {
        const proj = projects.find(p => p.id === e.project_id)
        map.set(key, {
          key, name: e.project_name || 'No project',
          ceiling: Number(proj?.budget_planned || 0), manager: proj?.manager, items: [],
        })
      }
      map.get(key).items.push(e)
    }
    return [...map.values()].map(g => {
      const plannedSum = g.items.reduce((s2, e) => s2 + Number(e.planned_amount || 0), 0)
      const actualSum  = g.items.reduce((s2, e) => s2 + Number(e.actual_amount || 0), 0)
      const used = plannedSum > 0 ? Math.round((actualSum / plannedSum) * 100) : 0
      return { ...g, plannedSum, actualSum, variance: plannedSum - actualSum, used,
               overCeiling: g.ceiling > 0 && plannedSum > g.ceiling }
    }).sort((a, b) => b.actualSum - a.actualSum)
  })()
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
        {can(user, 'budget:propose') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            Propose Entry
          </Button>
        )}
      </Box>

      {user?.role === 'admin' && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>{ADMIN_READONLY_NOTE}</Alert>
      )}

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

      {/* Spend grouped under the project it belongs to */}
      {loading ? (
        [1, 2, 3].map(i => (
          <Paper key={i} sx={{ p: 2.5, mb: 1.5 }}>
            <Skeleton variant="text" width="30%" height={26} />
            <Skeleton variant="text" width="50%" />
          </Paper>
        ))
      ) : entries.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>No budget recorded yet</Typography>
          <Typography variant="body2" color="text.secondary">
            {can(user, 'budget:propose')
              ? 'Propose an entry to start tracking spend against plan.'
              : 'Nothing has been proposed for your projects yet.'}
          </Typography>
        </Paper>
      ) : (
        groupedByProject.map(group => (
          <ProjectGroupCard
            key={group.key}
            title={group.name}
            subtitle={group.ceiling > 0
              ? `Approved budget ${money(group.ceiling)}${group.overCeiling ? ' · proposals exceed it' : ''}`
              : 'No approved budget set'}
            count={group.items.length}
            accent={group.overCeiling || group.variance < 0
              ? statusToken('blocked').dot
              : group.used > 75 ? statusToken('at_risk').dot : statusToken('completed').dot}
            progress={group.used}
            defaultOpen={groupedByProject.length <= 2 || group.variance < 0}
            stats={[
              { label: 'planned', value: money(group.plannedSum) },
              { label: 'actual', value: money(group.actualSum) },
              { label: group.variance >= 0 ? 'under' : 'over',
                value: money(Math.abs(group.variance)),
                tone: group.variance >= 0 ? statusToken('completed').fg : statusToken('blocked').fg },
            ]}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Proposed by</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Planned</TableCell>
                    <TableCell align="right">Actual</TableCell>
                    <TableCell align="right">Variance</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.items.map(e => {
                    const v = Number(e.planned_amount) - Number(e.actual_amount)
                    return (
                      <TableRow key={e.id} hover>
                        <TableCell><Chip label={e.category} size="small" variant="outlined" /></TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{e.description || '—'}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2">{e.proposed_by || '—'}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {e.entry_date ? new Date(e.entry_date).toLocaleDateString() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right"><Typography variant="subtitle2">{money(e.planned_amount)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2">{money(e.actual_amount)}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2" sx={{
                            color: v >= 0 ? statusToken('completed').fg : statusToken('blocked').fg }}>
                            {v >= 0 ? '+' : '−'}{money(Math.abs(v))}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {canEditBudgetEntry(user, e, projects) && (
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(e)}>
                              <EditIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                          {canDeleteBudgetEntry(user, e, projects) && (
                            <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => setDelConfirm(e)}>
                              <DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </ProjectGroupCard>
        ))
      )}

      {/* Dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{dialog.mode === 'create' ? 'Propose Budget Entry' : 'Edit Entry'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!showErr('project_id')}>
                <InputLabel>Project *</InputLabel>
                <Select label="Project *" value={dialog.data.project_id} onChange={f('project_id')}>
                  {assignableProjects.length === 0 && (
                    <MenuItem disabled value="">You do not manage any projects</MenuItem>
                  )}
                  {assignableProjects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
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
              <TextField fullWidth type="date" label="Date *" value={dialog.data.entry_date} onChange={f('entry_date')}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: selectedProject?.start_date ? selectedProject.start_date.split('T')[0] : undefined,
                  max: selectedProject?.end_date ? selectedProject.end_date.split('T')[0] : undefined,
                }}
                error={!!showErr('entry_date')}
                helperText={showErr('entry_date') ||
                  (selectedProject ? 'Must fall within the project window' : 'Select a project first')} />
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
            {selectedProject && (
              <Grid item xs={12}>
                <Alert severity={overCeiling ? 'warning' : 'info'} sx={{ fontSize: '0.8rem' }}>
                  {overCeiling
                    ? `This brings planned entries to $${projectedTotal.toLocaleString()}, exceeding ${selectedProject.name}'s $${ceiling.toLocaleString()} budget by $${(projectedTotal - ceiling).toLocaleString()}.`
                    : `Planned entries for ${selectedProject.name}: $${projectedTotal.toLocaleString()} of $${ceiling.toLocaleString()} budget.`}
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
