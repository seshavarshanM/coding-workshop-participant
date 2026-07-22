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
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import EmailIcon from '@mui/icons-material/Email'
import WorkIcon from '@mui/icons-material/Work'
import { resourceService } from '../services/resourceService'

const EMPTY = {
  name: '', email: '', role: '', department: '',
  capacity_hours: 40, allocated_hours: 0, projects: ''
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function getColor(name = '') {
  const colors = ['#1565C0','#7C3AED','#065F46','#9A3412','#1E40AF','#6B21A8']
  return colors[name.charCodeAt(0) % colors.length]
}

export default function Resources() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: EMPTY })
  const [delConfirm, setDelConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [touched, setTouched] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      setItems(await resourceService.getAll(params))
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setTouched({}); setDialog({ open: true, mode: 'create', data: EMPTY }) }
  const openEdit   = (r) => { setTouched({}); setDialog({ open: true, mode: 'edit', data: { ...r } }) }
  const closeDialog = () => setDialog(d => ({ ...d, open: false }))

  // ── Validation ──────────────────────────────────────────────
  const validate = (d) => {
    const errs = {}
    if (!d.name?.trim()) errs.name = 'Name is required'
    if (!d.role?.trim()) errs.role = 'Role is required'
    if (!d.department?.trim()) errs.department = 'Department is required'
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.email = 'Invalid email format'
    if (d.capacity_hours === '' || Number(d.capacity_hours) < 1) errs.capacity_hours = 'Capacity must be at least 1 hour'
    if (Number(d.allocated_hours) < 0) errs.allocated_hours = 'Cannot be negative'
    return errs
  }
  const errors = validate(dialog.data)
  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => touched[field] && errors[field]

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialog.mode === 'create') {
        await resourceService.create(dialog.data)
        setSnack({ open: true, msg: 'Resource added', sev: 'success' })
      } else {
        await resourceService.update(dialog.data.id, dialog.data)
        setSnack({ open: true, msg: 'Resource updated', sev: 'success' })
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
      await resourceService.remove(delConfirm.id)
      setSnack({ open: true, msg: 'Removed', sev: 'success' })
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

  const overAllocated = items.filter(r => Number(r.allocated_hours) > Number(r.capacity_hours))

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Resources</Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} team members
            {overAllocated.length > 0 && (
              <Chip label={`${overAllocated.length} over-allocated`} size="small" color="error"
                sx={{ ml: 1.5, fontWeight: 600, fontSize: '0.72rem' }} />
            )}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          Add Member
        </Button>
      </Box>

      <TextField
        size="small"
        placeholder="Search by name, role, email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mb: 2, minWidth: 280 }}
      />

      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Skeleton variant="text" width="60%" sx={{ mt: 1 }} />
                  <Skeleton variant="text" width="80%" />
                </Paper>
              </Grid>
            ))
          : items.length === 0
          ? (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                  <Typography color="text.secondary">No team members yet. Add your first resource!</Typography>
                </Paper>
              </Grid>
            )
          : items.map(r => {
              const allocPct = r.capacity_hours > 0
                ? Math.round((Number(r.allocated_hours) / Number(r.capacity_hours)) * 100)
                : 0
              const isOver = allocPct > 100

              return (
                <Grid item xs={12} sm={6} md={4} key={r.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5, borderRadius: 3,
                      border: '1px solid',
                      borderColor: isOver ? '#FCA5A5' : 'divider',
                      position: 'relative',
                    }}
                  >
                    {isOver && (
                      <Chip label="Over-allocated" size="small" color="error"
                        sx={{ position: 'absolute', top: 12, right: 44, fontWeight: 600, fontSize: '0.68rem' }} />
                    )}
                    <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex' }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => setDelConfirm(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: getColor(r.name), width: 44, height: 44, fontWeight: 700 }}>
                        {getInitials(r.name)}
                      </Avatar>
                      <Box>
                        <Typography fontWeight={700} fontSize="0.95rem">{r.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.role || 'No role set'}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                      {r.department && (
                        <Chip icon={<WorkIcon />} label={r.department} size="small"
                          sx={{ fontSize: '0.72rem', height: 22 }} />
                      )}
                    </Box>

                    {r.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                        <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{r.email}</Typography>
                      </Box>
                    )}

                    {r.projects && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Projects: {r.projects}
                      </Typography>
                    )}

                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Allocation</Typography>
                        <Typography variant="caption" fontWeight={700} color={isOver ? 'error.main' : 'text.primary'}>
                          {r.allocated_hours}h / {r.capacity_hours}h ({allocPct}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(allocPct, 100)}
                        sx={{
                          height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: isOver ? '#DC2626' : allocPct > 75 ? '#D97706' : '#16A34A',
                            borderRadius: 3
                          }
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              )
            })
        }
      </Grid>

      {/* Dialog */}
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{dialog.mode === 'create' ? 'Add Team Member' : 'Edit Member'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Full name *" value={dialog.data.name} onChange={f('name')}
              error={!!showErr('name')} helperText={showErr('name') || ''} /></Grid>
            <Grid item xs={12}><TextField fullWidth type="email" label="Email" value={dialog.data.email} onChange={f('email')}
              error={!!showErr('email')} helperText={showErr('email') || ''} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Role / Title *" value={dialog.data.role} onChange={f('role')}
              error={!!showErr('role')} helperText={showErr('role') || ''} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Department *" value={dialog.data.department} onChange={f('department')}
              error={!!showErr('department')} helperText={showErr('department') || ''} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Capacity (hrs/week) *" value={dialog.data.capacity_hours} onChange={f('capacity_hours')} inputProps={{ min: 1 }}
              error={!!showErr('capacity_hours')} helperText={showErr('capacity_hours') || ''} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Allocated (hrs/week)" value={dialog.data.allocated_hours} onChange={f('allocated_hours')} inputProps={{ min: 0 }}
              error={!!showErr('allocated_hours')} helperText={showErr('allocated_hours') || ''} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Current projects (comma separated)" value={dialog.data.projects} onChange={f('projects')} helperText="e.g. Alpha, Beta, Gamma" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !isValid}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onClose={() => setDelConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Remove team member?</DialogTitle>
        <DialogContent><Typography>"{delConfirm?.name}" will be removed from the system.</Typography></DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDelConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none' }}>Remove</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
