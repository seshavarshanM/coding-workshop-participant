import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DescriptionIcon from '@mui/icons-material/DescriptionRounded'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import EditIcon from '@mui/icons-material/EditRounded'
import { projectService } from '../services/projectService'
import { deliverableService } from '../services/deliverableService'
import { budgetService } from '../services/budgetService'
import { peopleService } from '../services/peopleService'
import { useAuth } from '../context/AuthContext'
import { canManageProjectTeam, canEditProject } from '../utils/permissions'
import StatusChip from '../components/StatusChip'
import DependencyChain from '../components/DependencyChain'
import { blockedCount } from '../utils/dependencies'

// ── Team-membership helpers (stored in resource.projects CSV as "Name (Xh)") ──
const teamEntry = (projName, hours) => `${projName} (${hours}h)`
const entriesOf = (r) => (r.projects || '').split(',').map(s => s.trim()).filter(Boolean)
const isOnTeam = (r, projName) =>
  entriesOf(r).some(e => e === projName || e.startsWith(`${projName} (`))
const hoursFor = (r, projName) => {
  const e = entriesOf(r).find(x => x === projName || x.startsWith(`${projName} (`))
  const m = e && e.match(/\((\d+)h\)/)
  return m ? Number(m[1]) : 0
}
const remainingOf = (r) => Math.max(0, Number(r.capacity_hours || 0) - Number(r.allocated_hours || 0))

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function getColor(name = '') {
  const colors = ['#1565C0', '#7C3AED', '#065F46', '#9A3412', '#1E40AF', '#6B21A8']
  return colors[name.charCodeAt(0) % colors.length]
}

function InfoItem({ label, value }) {
  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
    </Box>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [deliverables, setDeliverables] = useState([])
  const [budget, setBudget] = useState({ entries: [], summary: { total_planned: 0, total_actual: 0 } })
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({ resource_id: '', hours: '' })
  const [acknowledgeOver, setAcknowledgeOver] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      projectService.getById(id),
      deliverableService.getAll({ project_id: id }),
      budgetService.getAll({ project_id: id }),
      peopleService.getAll(),
    ])
      .then(([p, d, b, r]) => {
        setProject(p)
        setDeliverables(d)
        setBudget(b || { entries: [], summary: { total_planned: 0, total_actual: 0 } })
        setResources(r)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Tier A: project completion is DERIVED from its deliverables ──
  useEffect(() => {
    if (!project || deliverables.length === 0) return
    const avg = Math.round(
      deliverables.reduce((s, d) => s + Number(d.completion_percentage || 0), 0) / deliverables.length
    )
    if (avg !== Number(project.completion_percentage || 0)) {
      // persist the derived value so lists/dashboard stay consistent
      projectService.update(project.id, { completion_percentage: avg })
        .then(() => setProject(p => ({ ...p, completion_percentage: avg })))
        .catch(() => {})
    }
  }, [deliverables, project])

  if (loading) return (
    <Box>
      <Skeleton variant="text" width={300} height={40} />
      <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 3 }} />
    </Box>
  )
  if (error) return <Alert severity="error">{error}</Alert>
  if (!project) return <Alert severity="warning">Project not found</Alert>

  const team = resources.filter(r => isOnTeam(r, project.name))
  const available = resources
    .filter(r => !isOnTeam(r, project.name))
    .sort((a, b) => remainingOf(b) - remainingOf(a))

  const selectedResource = resources.find(r => r.id === assignForm.resource_id)
  // When editing, the hours already committed to this project are not
  // competing with themselves — add them back before judging what is free.
  const alreadyHere = selectedResource ? hoursFor(selectedResource, project.name) : 0
  const remaining = selectedResource ? remainingOf(selectedResource) + alreadyHere : 0
  const hoursNum = Number(assignForm.hours)
  // Over-allocating someone is sometimes a real decision — a sprint gets
  // pulled forward, someone covers absence. Blocking it outright would make
  // the situation invisible, so the system warns clearly and requires the
  // manager to acknowledge it, then reports the result.
  const hoursError =
    assignForm.hours === '' ? '' :
    hoursNum < 1 ? 'At least 1 hour' : ''
  const wouldOverAllocate = !!selectedResource && hoursNum > remaining
  const overBy = wouldOverAllocate ? hoursNum - remaining : 0
  const assignValid =
    assignForm.resource_id && assignForm.hours !== '' && !hoursError &&
    (!wouldOverAllocate || acknowledgeOver)

  /** Change how many hours someone is committed to this project. */
  const openEditHours = (r) => {
    setEditingMember(r)
    setAcknowledgeOver(false)
    setAssignForm({ resource_id: r.id, hours: String(hoursFor(r, project.name)) })
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    setSaving(true)
    try {
      const r = selectedResource
      const previous = hoursFor(r, project.name)      // 0 when newly assigned
      const others = entriesOf(r).filter(
        e => !(e === project.name || e.startsWith(`${project.name} (`)))
      const newProjects = [...others, teamEntry(project.name, hoursNum)].join(', ')
      await peopleService.update(r.id, {
        projects: newProjects,
        allocated_hours: Math.max(0, Number(r.allocated_hours || 0) - previous + hoursNum),
      })
      setSnack({
        open: true, sev: 'success',
        msg: previous
          ? `${r.name} updated to ${hoursNum}h/week`
          : `${r.name} assigned (${hoursNum}h/week)`,
      })
      setAssignOpen(false)
      setEditingMember(null)
      setAssignForm({ resource_id: '', hours: '' })
      load()
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleUnassign = async (r) => {
    try {
      const hrs = hoursFor(r, project.name)
      const newProjects = entriesOf(r)
        .filter(e => !(e === project.name || e.startsWith(`${project.name} (`)))
        .join(', ')
      await peopleService.update(r.id, {
        projects: newProjects,
        allocated_hours: Math.max(0, Number(r.allocated_hours || 0) - hrs),
      })
      setSnack({ open: true, msg: `${r.name} removed from team`, sev: 'success' })
      load()
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    }
  }

  // Budget used is COMPUTED from this project's budget entries (single source of truth)
  const spentFromEntries = Number(budget.summary?.total_actual || 0)
  const budgetPct = project.budget_planned > 0
    ? Math.round((spentFromEntries / Number(project.budget_planned)) * 100) : 0
  const derivedCompletion = deliverables.length > 0
    ? Math.round(deliverables.reduce((s, d) => s + Number(d.completion_percentage || 0), 0) / deliverables.length)
    : Number(project.completion_percentage || 0)
  const doneCount = deliverables.filter(d => d.status === 'completed').length
  const totalDels = deliverables.length
  const canManageTeam = canManageProjectTeam(user, project)

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')}
        sx={{ textTransform: 'none', mb: 2, color: 'text.secondary' }}>
        Back to Projects
      </Button>

      {/* ── Header card ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2, overflow: 'hidden',
      }}>
        {/* Accent strip */}
        <Box sx={{ height: 6, background: 'linear-gradient(90deg,#1565C0,#7C3AED)' }} />
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={800}>{project.name}</Typography>
                <StatusChip value={project.status} size="medium" />
                <StatusChip value={project.priority} size="medium" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
                {project.description || 'No description provided.'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<DescriptionIcon />}
                onClick={() => navigate(`/projects/${project.id}/report`)}>
                Status report
              </Button>
              {canEditProject(user, project) && (
                <Button variant="outlined" onClick={() => navigate('/projects')}>
                  Edit project
                </Button>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Info row — flex wrap, no overlap */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 3 }}>
            <InfoItem label="Manager" value={project.manager} />
            <InfoItem label="Department" value={project.department} />
            <InfoItem label="Start" value={project.start_date ? new Date(project.start_date).toLocaleDateString() : null} />
            <InfoItem label="Deadline" value={project.end_date ? new Date(project.end_date).toLocaleDateString() : null} />
            <InfoItem label="Team size" value={`${team.length} member${team.length === 1 ? '' : 's'}`} />
          </Box>

          {/* Progress row — its own line, half/half */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Completion</Typography>
                <Typography variant="caption" fontWeight={700}>{derivedCompletion}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={derivedCompletion}
                sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0',
                  '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 4 } }} />
              <Typography variant="caption" color="text.secondary">
                {doneCount}/{totalDels} deliverables done
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Budget used</Typography>
                <Typography variant="caption" fontWeight={700}>{budgetPct}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.min(budgetPct, 100)}
                sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: budgetPct > 90 ? '#DC2626' : budgetPct > 70 ? '#D97706' : '#16A34A',
                    borderRadius: 4 } }} />
              <Typography variant="caption" color="text.secondary">
                ${spentFromEntries.toLocaleString()} spent (from entries) / ${Number(project.budget_planned || 0).toLocaleString()} planned
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* ── Team section (Feature #3: smart assignment with availability) ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Team ({team.length})</Typography>
          {canManageTeam && (
            <Button size="small" variant="contained" startIcon={<PersonAddIcon />}
              onClick={() => { setEditingMember(null); setAssignForm({ resource_id: '', hours: '' }); setAcknowledgeOver(false); setAssignOpen(true) }}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>
              Assign member
            </Button>
          )}
        </Box>
        <Divider />
        {team.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              No team assigned yet.{canManageTeam ? ' Use "Assign member" to build the team from available capacity.' : ''}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {team.map(r => (
              <Paper key={r.id} elevation={0} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#FAFBFC',
              }}>
                <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', fontWeight: 700, bgcolor: getColor(r.name) }}>
                  {getInitials(r.name)}
                </Avatar>
                <Box>
                  <Typography fontSize="0.85rem" fontWeight={600} lineHeight={1.2}>{r.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.role || '—'}</Typography>
                </Box>
                <Chip size="small" label={`${hoursFor(r, project.name)}h/wk`}
                  sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: '#DBEAFE', color: '#1565C0' }} />
                {canManageTeam && (
                  <>
                    <Tooltip title="Change hours">
                      <IconButton size="small" onClick={() => openEditHours(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove from team">
                      <IconButton size="small" color="error" onClick={() => handleUnassign(r)}>
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* ── Delivery sequence: how the work depends on itself ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography fontWeight={700}>Delivery Sequence</Typography>
            <Typography variant="caption" color="text.secondary">
              Which deliverable is holding up the ones after it
            </Typography>
          </Box>
          {blockedCount(deliverables) > 0 && (
            <Chip label={`${blockedCount(deliverables)} blocked`} size="small"
              sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: '#FEE2E2', color: '#991B1B' }} />
          )}
        </Box>
        <Divider />
        <DependencyChain deliverables={deliverables} />
      </Paper>

      {/* ── Deliverables ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Deliverables ({totalDels})</Typography>
          <Button size="small" onClick={() => navigate('/deliverables')} sx={{ textTransform: 'none' }}>
            Manage →
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliverables.length === 0
                ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No deliverables for this project</TableCell></TableRow>
                : deliverables.map(d => (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.description}</Typography>
                      </TableCell>
                      <TableCell><StatusChip value={d.status} /></TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{d.assigned_to || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                        {d.due_date ? new Date(d.due_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={d.completion_percentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }} />
                          <Typography variant="caption">{d.completion_percentage || 0}%</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Budget entries ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Budget Entries ({budget.entries?.length || 0})</Typography>
          <Button size="small" onClick={() => navigate('/budget')} sx={{ textTransform: 'none' }}>
            Manage →
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Planned ($)</TableCell>
                <TableCell align="right">Actual ($)</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(budget.entries || []).length === 0
                ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No budget entries</TableCell></TableRow>
                : (budget.entries || []).map(e => {
                    const variance = Number(e.planned_amount) - Number(e.actual_amount)
                    return (
                      <TableRow key={e.id} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{e.category}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>{e.description || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>${Number(e.planned_amount).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>${Number(e.actual_amount).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Chip label={`${variance >= 0 ? '+' : ''}$${variance.toLocaleString()}`} size="small"
                            sx={{ fontWeight: 600, fontSize: '0.72rem',
                              color: variance >= 0 ? '#166534' : '#991B1B',
                              bgcolor: variance >= 0 ? '#DCFCE7' : '#FEE2E2' }} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
              {(budget.entries || []).length > 0 && (
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>${Number(budget.summary?.total_planned || 0).toLocaleString()}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>${Number(budget.summary?.total_actual || 0).toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Assign dialog: capacity-aware member picker ── */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingMember ? `Change ${editingMember.name}\u2019s hours` : 'Assign team member'}</DialogTitle>
        <DialogContent dividers>
          <TextField select fullWidth label="Member (sorted by free capacity)"
            value={assignForm.resource_id}
            disabled={!!editingMember}
            onChange={e => { setAcknowledgeOver(false); setAssignForm(f => ({ ...f, resource_id: e.target.value })) }}
            sx={{ mb: 2, mt: 0.5 }}>
            {editingMember && (
              <MenuItem value={editingMember.id}>
                {editingMember.name} · {editingMember.title || editingMember.role}
              </MenuItem>
            )}
            {available.length === 0 && <MenuItem disabled value="">Everyone is already on this team</MenuItem>}
            {available.map(r => {
              const rem = remainingOf(r)
              const util = r.capacity_hours > 0
                ? Math.round((Number(r.allocated_hours) / Number(r.capacity_hours)) * 100) : 0
              return (
                <MenuItem key={r.id} value={r.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                    <span>{r.name} · {r.role || 'No role'}</span>
                    <Chip size="small"
                      label={rem === 0 ? 'Full' : util < 50 ? `Available · ${rem}h free` : `${rem}h free`}
                      sx={{
                        fontWeight: 700, fontSize: '0.68rem',
                        bgcolor: rem === 0 ? '#FEE2E2' : util < 50 ? '#DCFCE7' : '#FEF3C7',
                        color:   rem === 0 ? '#991B1B' : util < 50 ? '#166534' : '#92400E',
                      }} />
                  </Box>
                </MenuItem>
              )
            })}
          </TextField>
          <TextField fullWidth type="number" label="Hours per week"
            value={assignForm.hours}
            onChange={e => { setAcknowledgeOver(false); setAssignForm(f => ({ ...f, hours: e.target.value })) }}
            inputProps={{ min: 1 }}
            error={!!hoursError} helperText={hoursError || (selectedResource ? `${remaining}h remaining of ${selectedResource.capacity_hours}h capacity` : '')} />
          {wouldOverAllocate && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                This will over-allocate {selectedResource.name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {selectedResource.name} has {remaining}h free of {selectedResource.capacity_hours}h.
                Assigning {hoursNum}h puts them {overBy}h beyond capacity.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={acknowledgeOver}
                    onChange={e => setAcknowledgeOver(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Assign anyway — I accept they will be over capacity
                  </Typography>
                }
              />
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAssignOpen(false); setEditingMember(null) }}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={saving || !assignValid}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : editingMember ? 'Update hours' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
