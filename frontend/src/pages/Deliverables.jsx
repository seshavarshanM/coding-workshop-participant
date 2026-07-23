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
import Grid from '@mui/material/Grid'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { deliverableService } from '../services/deliverableService'
import { useAuth } from '../context/AuthContext'
import { can, canUpdateProgress, canEditDeliverable, canDeleteDeliverable, ADMIN_READONLY_NOTE } from '../utils/permissions'
import { isBlocked, blockReason, dependencyOf, validDependencyOptions, blockedCount, canProgress, completionBlockReason } from '../utils/dependencies'
import BlockIcon from '@mui/icons-material/Block'
import LinkIcon from '@mui/icons-material/Link'
import { projectService } from '../services/projectService'
import { peopleService } from '../services/peopleService'
import StatusChip from '../components/StatusChip'

const EMPTY = {
  name: '', description: '', project_id: '', project_name: '',
  status: 'pending', due_date: '', assigned_to: '', completion_percentage: 0
}

export default function Deliverables() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: EMPTY, limited: false })
  const [delConfirm, setDelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [touched, setTouched] = useState({})

  const [people, setPeople] = useState([])
  useEffect(() => {
    projectService.getAll().then(setProjects).catch(() => {})
    peopleService.getAll().then(setPeople).catch(() => {})
  }, [])

  // ── Scoping helpers ────────────────────────────────────────────────
  // Managers may only create/edit deliverables on projects they manage.
  const assignableProjects = projects.filter(
    p => user?.role === 'admin' || p.manager === user?.name
  )
  // The project selected in the dialog (used for team + date constraints).
  const dialogProject = projects.find(p => p.id === dialog.data.project_id)
  // Valid predecessors: same project, not itself, and no circular chains.
  const dependencyChoices = validDependencyOptions(
    { ...dialog.data, project_id: dialog.data.project_id }, items
  )
  // Only people actually allocated to that project may be assigned work on it.
  const projectTeam = dialogProject
    ? people.filter(pp => {
        const list = (pp.projects || '').split(',').map(x => x.trim())
        return list.some(e => e === dialogProject.name || e.startsWith(`${dialogProject.name} (`))
      })
    : []

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterProject) params.project_id = filterProject
      if (filterStatus) params.status = filterStatus
      setItems(await deliverableService.getAll(params))
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filterProject, filterStatus])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setTouched({}); setDialog({ open: true, mode: 'create', data: EMPTY, limited: false }) }
  const openEdit   = (d, limited = false) => { setTouched({}); setDialog({
    open: true, mode: 'edit', limited,
    data: { ...d, due_date: d.due_date?.split('T')[0] || '' }
  }) }
  const closeDialog = () => setDialog(d => ({ ...d, open: false }))

  // ── Validation ──────────────────────────────────────────────
  const validate = (d) => {
    const errs = {}
    if (!d.name?.trim()) errs.name = 'Deliverable name is required'
    if (!d.project_id) errs.project_id = 'Project is required'
    if (!d.due_date) errs.due_date = 'Due date is required'
    else if (dialogProject) {
      if (dialogProject.start_date && d.due_date < dialogProject.start_date.split('T')[0])
        errs.due_date = `Cannot be before the project starts (${new Date(dialogProject.start_date).toLocaleDateString()})`
      else if (dialogProject.end_date && d.due_date > dialogProject.end_date.split('T')[0])
        errs.due_date = `Cannot be after the project deadline (${new Date(dialogProject.end_date).toLocaleDateString()})`
    }
    if (!d.assigned_to?.trim()) errs.assigned_to = 'Assignee is required'
    else if (dialogProject && projectTeam.length > 0 &&
             !projectTeam.some(pp => pp.name === d.assigned_to))
      errs.assigned_to = 'Assignee must be a member of this project team'
    if (d.completion_percentage !== '' && (Number(d.completion_percentage) < 0 || Number(d.completion_percentage) > 100))
      errs.completion_percentage = 'Must be between 0 and 100'
    // Finish-to-start: a dependent cannot record progress until its
    // predecessor is complete.
    if (!canProgress(d, items) && (Number(d.completion_percentage || 0) > 0 ||
        (d.status !== 'pending' && d.status !== 'blocked')))
      errs.status = completionBlockReason(d, items)
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => touched[field] && errors[field]

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data }
      // auto-fill project_name from selected project
      if (payload.project_id) {
        const proj = projects.find(p => p.id === payload.project_id)
        if (proj) payload.project_name = proj.name
      }
      if (dialog.mode === 'create') {
        await deliverableService.create(payload)
        setSnack({ open: true, msg: 'Deliverable created', sev: 'success' })
      } else {
        await deliverableService.update(dialog.data.id, payload)
        setSnack({ open: true, msg: 'Deliverable updated', sev: 'success' })
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
      await deliverableService.remove(delConfirm.id)
      setSnack({ open: true, msg: 'Deleted', sev: 'success' })
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

  // ── Tier A: status <-> completion are bound together ──────────
  // Completed => 100%; any status change to non-completed with 100% relaxes to 99 if user then edits.
  const setStatus = (e) => {
    const status = e.target.value
    setTouched(t => ({ ...t, status: true }))
    setDialog(d => {
      // Finish-to-start: no progress at all until the predecessor is done.
      if (!canProgress(d.data, items) && status !== 'pending' && status !== 'blocked') {
        setSnack({ open: true, sev: 'warning',
          msg: completionBlockReason(d.data, items) })
        return d
      }
      let pct = Number(d.data.completion_percentage) || 0
      if (status === 'completed') pct = 100
      else if (status === 'pending') pct = 0
      else if (pct === 100) pct = 90  // reopening a done item
      return { ...d, data: { ...d.data, status, completion_percentage: pct } }
    })
  }
  const setCompletion = (e) => {
    let pct = e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value)))
    setTouched(t => ({ ...t, completion_percentage: true }))
    setDialog(d => {
      if (pct > 0 && !canProgress(d.data, items)) {
        setSnack({ open: true, sev: 'warning',
          msg: completionBlockReason(d.data, items) })
        pct = 0    // work has not legitimately started yet
      }
      let status = d.data.status
      if (pct === 100) status = 'completed'
      else if (pct === 0) status = 'pending'
      else if (status === 'completed' || status === 'pending') status = 'in_progress'
      return { ...d, data: { ...d.data, completion_percentage: pct, status } }
    })
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Deliverables</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">{items.length} total</Typography>
            {blockedCount(items) > 0 && (
              <Chip icon={<BlockIcon sx={{ fontSize: 14 }} />} label={`${blockedCount(items)} blocked by dependencies`}
                size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: '#FEE2E2', color: '#991B1B' }} />
            )}
          </Box>
        </Box>
        {can(user, 'deliverable:create') && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            New Deliverable
          </Button>
        )}
      </Box>

      {user?.role === 'admin' && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>{ADMIN_READONLY_NOTE}</Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Project</InputLabel>
          <Select label="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <MenuItem value="">All projects</MenuItem>
            {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">All statuses</MenuItem>
            {['pending','in_progress','completed','blocked'].map(s => (
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
                <TableCell>Deliverable</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Depends On</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Progress</TableCell>
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
                : items.length === 0
                ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No deliverables found.
                  </TableCell></TableRow>
                : items.map(d => (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.description}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{d.project_name || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {(() => {
                          const dep = dependencyOf(d, items)
                          if (!dep) return <Typography variant="caption" color="text.secondary">—</Typography>
                          return (
                            <Tooltip title={`${dep.name} — ${dep.completion_percentage || 0}% complete`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LinkIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                <Typography variant="caption" noWrap sx={{ maxWidth: 130 }}>{dep.name}</Typography>
                              </Box>
                            </Tooltip>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StatusChip value={d.status} />
                          {isBlocked(d, items) && (
                            <Tooltip title={blockReason(d, items)}>
                              <BlockIcon sx={{ fontSize: 15, color: '#DC2626' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{d.assigned_to || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                        {d.due_date ? new Date(d.due_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={d.completion_percentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }}
                          />
                          <Typography variant="caption">{d.completion_percentage || 0}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {canEditDeliverable(user, d, projects) ? (
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(d)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        ) : canUpdateProgress(user, d, projects) && (
                          <Tooltip title="Update my progress"><IconButton size="small" color="primary" onClick={() => openEdit(d, true)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                        {canDeleteDeliverable(user, d, projects) && (
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDelConfirm(d)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{dialog.limited ? 'Update My Progress' : dialog.mode === 'create' ? 'New Deliverable' : 'Edit Deliverable'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            {dialog.limited && (
              <Grid item xs={12}>
                <Typography fontWeight={600}>{dialog.data.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  You can update only the status and completion of your own deliverable.
                </Typography>
              </Grid>
            )}
            {!dialog.limited && (
            <Grid item xs={12}>
              <TextField fullWidth label="Name *" value={dialog.data.name} onChange={f('name')}
                error={!!showErr('name')} helperText={showErr('name') || ''} />
            </Grid>
            )}
            {!dialog.limited && (
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={dialog.data.description} onChange={f('description')} />
            </Grid>
            )}
            {!dialog.limited && (
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
            )}
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={dialog.data.status} onChange={setStatus}
                  disabled={!canProgress(dialog.data, items)}>
                  {['pending','in_progress','completed','blocked'].map(s => (
                    <MenuItem key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {!dialog.limited && (
            <Grid item xs={12}>
              <TextField select fullWidth label="Depends on (optional)"
                value={dialog.data.depends_on || ''}
                onChange={f('depends_on')}
                disabled={!dialogProject}
                helperText={!dialogProject
                  ? 'Select a project first'
                  : dependencyChoices.length === 0
                  ? 'No other deliverables in this project yet'
                  : 'This work cannot finish until the selected deliverable is complete'}>
                <MenuItem value="">No dependency</MenuItem>
                {dependencyChoices.map(dc => (
                  <MenuItem key={dc.id} value={dc.id}>
                    {dc.name} · {dc.completion_percentage || 0}%
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            )}
            {!canProgress(dialog.data, items) && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                  {completionBlockReason(dialog.data, items)}
                </Alert>
              </Grid>
            )}
            {!dialog.limited && (<>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Due date *" value={dialog.data.due_date} onChange={f('due_date')}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: dialogProject?.start_date ? dialogProject.start_date.split('T')[0] : undefined,
                  max: dialogProject?.end_date ? dialogProject.end_date.split('T')[0] : undefined,
                }}
                error={!!showErr('due_date')}
                helperText={showErr('due_date') ||
                  (dialogProject
                    ? `Must fall within the project window`
                    : 'Select a project to set the allowed range')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Assigned to *" value={dialog.data.assigned_to} onChange={f('assigned_to')}
                error={!!showErr('assigned_to')} helperText={showErr('assigned_to') || ''}>
                {!dialogProject && <MenuItem disabled value="">Select a project first</MenuItem>}
                {dialogProject && projectTeam.length === 0 && (
                  <MenuItem disabled value="">No one is assigned to this project team yet</MenuItem>
                )}
                {projectTeam.map(pp => (
                  <MenuItem key={pp.id} value={pp.name}>
                    {pp.name} · {pp.title || pp.role}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            </>)}
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Completion (%)" value={dialog.data.completion_percentage} onChange={setCompletion} inputProps={{ min: 0, max: 100 }}
                disabled={!canProgress(dialog.data, items)}
                error={!!showErr('completion_percentage')}
                helperText={showErr('completion_percentage') ||
                  (!canProgress(dialog.data, items)
                    ? 'Locked until the dependency is complete'
                    : 'Linked to status: 100% = Completed')} />
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
        <DialogTitle fontWeight={700}>Delete deliverable?</DialogTitle>
        <DialogContent>
          <Typography>"{delConfirm?.name}" will be permanently deleted.</Typography>
        </DialogContent>
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
