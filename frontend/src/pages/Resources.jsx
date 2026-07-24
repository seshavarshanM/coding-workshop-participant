import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import EmailIcon from '@mui/icons-material/Email'
import BadgeIcon from '@mui/icons-material/Badge'
import { peopleService } from '../services/peopleService'
import { palette, shadow, statusToken } from '../theme/tokens'
import { useAuth } from '../context/AuthContext'
import { can, canHire } from '../utils/permissions'
import PersonDetailDialog from '../components/PersonDetailDialog'
import { deliverableService } from '../services/deliverableService'
import { projectService } from '../services/projectService'

const EMPTY = {
  name: '', email: '', password: '', role: 'member', title: '', department: '',
  capacity_hours: 40, allocated_hours: 0, phone: '', location: '', bio: '',
}

const ROLE_STYLE = {
  admin:   { bg: '#EDE9FE', color: '#5B21B6', label: 'Admin' },
  manager: { bg: '#DBEAFE', color: '#1E40AF', label: 'Manager' },
  member:  { bg: '#F1F5F9', color: '#475569', label: 'Member' },
}

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const avatarColor = (name = '') => {
  const colors = ['#1565C0', '#7C3AED', '#065F46', '#9A3412', '#1E40AF', '#6B21A8']
  return colors[(name.charCodeAt(0) || 0) % colors.length]
}

export default function Resources() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: EMPTY })
  const [delConfirm, setDelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState({})
  const [viewing, setViewing] = useState(null)
  const [deliverables, setDeliverables] = useState([])
  const [projects, setProjects] = useState([])
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      setItems(await peopleService.getAll(params))
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  // Loaded once so a person's card can show what they are actually working on.
  useEffect(() => {
    deliverableService.getAll().then(setDeliverables).catch(() => {})
    projectService.getAll().then(setProjects).catch(() => {})
  }, [])

  const openCreate = () => { setTouched({}); setDialog({ open: true, mode: 'create', data: EMPTY }) }
  const openEdit = (r) => { setTouched({}); setDialog({ open: true, mode: 'edit', data: { ...r, password: '' } }) }
  const closeDialog = () => setDialog(d => ({ ...d, open: false }))

  const validate = (d) => {
    const errs = {}
    if (!d.name?.trim()) errs.name = 'Name is required'
    if (!d.email?.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.email = 'Invalid email format'
    if (!d.title?.trim()) errs.title = 'Job title is required'
    if (!d.department?.trim()) errs.department = 'Department is required'
    if (dialog.mode === 'create' && !d.password) errs.password = 'Password is required for a new account'
    if (d.password && d.password.length < 8) errs.password = 'Minimum 8 characters'
    if (d.capacity_hours === '' || Number(d.capacity_hours) < 1) errs.capacity_hours = 'Must be at least 1 hour'
    if (Number(d.allocated_hours) < 0) errs.allocated_hours = 'Cannot be negative'
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (f) => touched[f] && errors[f]

  const f = (field) => (e) => {
    setTouched(t => ({ ...t, [field]: true }))
    setDialog(d => ({ ...d, data: { ...d.data, [field]: e.target.value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...dialog.data }
      if (!payload.password) delete payload.password   // don't overwrite on edit
      if (dialog.mode === 'create') {
        await peopleService.create(payload)
        setSnack({ open: true, msg: 'Team member hired and onboarded', sev: 'success' })
      } else {
        await peopleService.update(dialog.data.id, payload)
        setSnack({ open: true, msg: 'Team member updated', sev: 'success' })
      }
      closeDialog()
      load()
    } catch (e) {
      const msg = e?.response?.data?.message || e.message
      setSnack({ open: true, msg, sev: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await peopleService.remove(delConfirm.id)
      setSnack({ open: true, msg: 'Team member removed', sev: 'success' })
      setDelConfirm(null)
      load()
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    }
  }

  const utilisation = r =>
    Number(r.capacity_hours) > 0
      ? (Number(r.allocated_hours) / Number(r.capacity_hours)) * 100
      : 0

  const overAllocated = items.filter(r => Number(r.allocated_hours) > Number(r.capacity_hours))
  const available = items.filter(r => utilisation(r) < 50)

  // "Which team members are over-allocated?" should be one click, not a scan.
  const shown = view === 'over'
    ? [...overAllocated].sort((a, b) => utilisation(b) - utilisation(a))
    : view === 'available'
    ? [...available].sort((a, b) => utilisation(a) - utilisation(b))
    : items

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Resources</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {items.length} team {items.length === 1 ? 'member' : 'members'}
            </Typography>
            {available.length > 0 && (
              <Chip label={`${available.length} available`} size="small"
                sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: '#DCFCE7', color: '#166534' }} />
            )}
            {overAllocated.length > 0 && (
              <Chip label={`${overAllocated.length} over-allocated`} size="small"
                sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: '#FEE2E2', color: '#991B1B' }} />
            )}
          </Box>
        </Box>
        {canHire(user) && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            Hire Member
          </Button>
        )}
      </Box>

      <TextField
        size="small"
        placeholder="Search by name, role, email or employee ID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mb: 3, width: { xs: '100%', sm: 380 } }}
      />

      {/* Cards */}
      <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ mb: 2.5 }}>
        <Tab value="all" label={`Everyone (${items.length})`} />
        <Tab value="over" label={`Over-allocated (${overAllocated.length})`} />
        <Tab value="available" label={`Available (${available.length})`} />
      </Tabs>

      {/* CSS Grid rather than MUI's Grid: the column count is stated outright,
          so card width never depends on how flex-basis and max-width interact. */}
      <Box sx={{
        display: 'grid',
        gap: 2.5,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
        },
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Paper key={i} sx={{ p: 2.5 }}>
                <Skeleton variant="circular" width={48} height={48} />
                <Skeleton variant="text" width="60%" sx={{ mt: 1.5 }} />
                <Skeleton variant="text" width="85%" />
                <Skeleton variant="rectangular" height={6} sx={{ mt: 2, borderRadius: 3 }} />
              </Paper>
            ))
          : shown.length === 0
          ? (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Paper sx={{ p: 6, borderStyle: 'dashed', textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    {view === 'over'
                      ? 'Nobody is over capacity right now.'
                      : view === 'available'
                      ? 'Everyone is more than half committed.'
                      : `No team members found${search ? ' for that search' : ''}.`}
                  </Typography>
                </Paper>
              </Box>
            )
          : shown.map(r => {
              const cap = Number(r.capacity_hours) || 0
              const alloc = Number(r.allocated_hours) || 0
              const pct = cap > 0 ? Math.round((alloc / cap) * 100) : 0
              const isOver = alloc > cap
              const isFree = pct < 50
              const role = ROLE_STYLE[r.role] || ROLE_STYLE.member
              const projectList = (r.projects || '').split(',').map(s => s.trim()).filter(Boolean)

              return (
                  <Paper
                    key={r.id}
                    onClick={() => setViewing(r)}
                    sx={{
                      p: 2.5, height: '100%', minWidth: 0, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      borderColor: isOver ? statusToken('blocked').dot : 'divider',
                      transition: 'border-color .15s ease, box-shadow .15s ease',
                      '&:hover': {
                        borderColor: isOver ? statusToken('blocked').dot : palette.borderStrong,
                        boxShadow: shadow.sm,
                      },
                    }}
                  >
                    {/* Top row: avatar + name + actions */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                      <Avatar sx={{ bgcolor: avatarColor(r.name), width: 48, height: 48, fontWeight: 700, fontSize: '1rem' }}>
                        {initials(r.name)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize="0.95rem" noWrap title={r.name}>
                          {r.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap
                          sx={{ display: 'block' }} title={r.title}>
                          {r.title || 'No title set'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {can(user, 'person:edit') && (
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {can(user, 'person:delete') && (
                          <Tooltip title="Remove">
                            <IconButton size="small" color="error" onClick={() => setDelConfirm(r)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                    {/* Badges */}
                    <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                      <Chip label={role.label} size="small"
                        sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22, bgcolor: role.bg, color: role.color }} />
                      {r.department && (
                        <Chip label={r.department} size="small" variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 22 }} />
                      )}
                      {isOver ? (
                        <Chip label="Over-allocated" size="small"
                          sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22, bgcolor: '#FEE2E2', color: '#991B1B' }} />
                      ) : isFree ? (
                        <Chip label="Available" size="small"
                          sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22, bgcolor: '#DCFCE7', color: '#166534' }} />
                      ) : null}
                    </Box>

                    {/* Contact */}
                    <Box sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <BadgeIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {r.employee_id}
                        </Typography>
                      </Box>
                      {r.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <EmailIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                          <Typography variant="caption" color="text.secondary" noWrap title={r.email}>
                            {r.email}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Projects */}
                    {projectList.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                        {projectList.map((p, i) => (
                          <Chip key={i} label={p.replace(/\s*\(\d+h\)/, '')} size="small" variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20 }} />
                        ))}
                      </Box>
                    )}

                    {/* Allocation — pinned to bottom */}
                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'baseline', gap: 1, mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary"
                          sx={{ whiteSpace: 'nowrap' }}>Allocation</Typography>
                        <Typography variant="caption" fontWeight={700} noWrap
                          color={isOver ? 'error.main' : 'text.primary'}>
                          {alloc}h / {cap}h · {pct}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={Math.min(pct, 100)}
                        sx={{
                          height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: isOver ? '#DC2626' : pct > 75 ? '#D97706' : '#16A34A',
                            borderRadius: 3,
                          },
                        }} />
                    </Box>
                  </Paper>
              )
            })}
      </Box>

      <PersonDetailDialog
        person={viewing}
        deliverables={deliverables}
        projects={projects}
        onClose={() => setViewing(null)}
      />

      {/* Create / edit dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {dialog.mode === 'create' ? 'Hire Team Member' : `Edit ${dialog.data.name}`}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full name *" value={dialog.data.name} onChange={f('name')}
                error={!!showErr('name')} helperText={showErr('name') || ''} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="email" label="Email *" value={dialog.data.email} onChange={f('email')}
                error={!!showErr('email')} helperText={showErr('email') || 'Used to sign in'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="System role *" value={dialog.data.role} onChange={f('role')}>
                <MenuItem value="admin">Admin — full access</MenuItem>
                <MenuItem value="manager">Manager — runs projects</MenuItem>
                <MenuItem value="member">Member — does the work</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="password"
                label={dialog.mode === 'create' ? 'Password *' : 'New password'}
                value={dialog.data.password} onChange={f('password')}
                error={!!showErr('password')}
                helperText={showErr('password') || (dialog.mode === 'edit' ? 'Leave blank to keep current' : 'Stored as a bcrypt hash')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Job title *" value={dialog.data.title} onChange={f('title')}
                error={!!showErr('title')} helperText={showErr('title') || ''} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Department *" value={dialog.data.department} onChange={f('department')}
                error={!!showErr('department')} helperText={showErr('department') || ''} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth type="number" label="Capacity (h/wk) *" value={dialog.data.capacity_hours}
                onChange={f('capacity_hours')} inputProps={{ min: 1 }}
                error={!!showErr('capacity_hours')} helperText={showErr('capacity_hours') || ''} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth type="number" label="Allocated (h/wk)" value={dialog.data.allocated_hours}
                onChange={f('allocated_hours')} inputProps={{ min: 0 }}
                error={!!showErr('allocated_hours')} helperText={showErr('allocated_hours') || ''} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={dialog.data.phone || ''} onChange={f('phone')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Location" value={dialog.data.location || ''} onChange={f('location')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Bio" value={dialog.data.bio || ''} onChange={f('bio')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !isValid}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Add member' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onClose={() => setDelConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Remove team member?</DialogTitle>
        <DialogContent>
          <Typography>
            {delConfirm?.name} ({delConfirm?.employee_id}) will lose access and be removed from the resource pool.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDelConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none' }}>Remove</Button>
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
