import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import BadgeIcon from '@mui/icons-material/Badge'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import PlaceIcon from '@mui/icons-material/Place'
import EventIcon from '@mui/icons-material/Event'
import { useAuth } from '../context/AuthContext'
import { projectService } from '../services/projectService'
import { deliverableService } from '../services/deliverableService'
import StatusChip from '../components/StatusChip'

const ROLE_STYLE = {
  admin:   { bg: '#EDE9FE', color: '#5B21B6', label: 'Admin',   blurb: 'Full platform access, including deletions and people management.' },
  manager: { bg: '#DBEAFE', color: '#1E40AF', label: 'Manager', blurb: 'Creates and runs projects, assigns team members, records budget.' },
  member:  { bg: '#F1F5F9', color: '#475569', label: 'Member',  blurb: 'Read-only access; updates progress on own deliverables.' },
}

const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

function Detail({ icon: Icon, label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.85 }}>
      <Icon sx={{ fontSize: 17, color: 'text.secondary', mt: 0.2, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600}
          sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word' }}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([projectService.getAll(), deliverableService.getAll()])
      .then(([p, d]) => { setProjects(p); setDeliverables(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (!user) return <Alert severity="warning">Not signed in.</Alert>

  const role = ROLE_STYLE[user.role] || ROLE_STYLE.member
  const cap = Number(user.capacity_hours) || 0
  const alloc = Number(user.allocated_hours) || 0
  const pct = cap > 0 ? Math.round((alloc / cap) * 100) : 0
  const isOver = alloc > cap

  const myProjects = projects.filter(p => p.manager === user.name)
  const myDeliverables = deliverables.filter(d => d.assigned_to === user.name)
  const projectChips = (user.projects || '').split(',').map(s => s.trim()).filter(Boolean)

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>My Profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Your account details, workload and assignments
        </Typography>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        {/* Identity card */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ height: 6, background: 'linear-gradient(90deg,#1565C0,#7C3AED)' }} />
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: '#1565C0', fontSize: '1.4rem', fontWeight: 700 }}>
                  {initials(user.name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={800} noWrap>{user.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {user.title || 'No title set'}
                  </Typography>
                  <Chip label={role.label} size="small"
                    sx={{ mt: 0.75, fontWeight: 700, fontSize: '0.68rem', height: 22, bgcolor: role.bg, color: role.color }} />
                </Box>
              </Box>

              {user.bio && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {user.bio}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Detail icon={BadgeIcon} label="Employee ID" value={user.employee_id} mono />
              <Detail icon={EmailIcon} label="Email" value={user.email} />
              <Detail icon={PhoneIcon} label="Phone" value={user.phone} />
              <Detail icon={PlaceIcon} label="Location" value={user.location} />
              <Detail icon={EventIcon} label="Joined"
                value={user.joined_date ? new Date(user.joined_date).toLocaleDateString() : null} />
              <Detail icon={BadgeIcon} label="Department" value={user.department} />

              <Divider sx={{ my: 2 }} />

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">Weekly allocation</Typography>
                  <Typography variant="caption" fontWeight={700} color={isOver ? 'error.main' : 'text.primary'}>
                    {alloc}h / {cap}h · {pct}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={Math.min(pct, 100)}
                  sx={{
                    height: 8, borderRadius: 4, bgcolor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: isOver ? '#DC2626' : pct > 75 ? '#D97706' : '#16A34A', borderRadius: 4,
                    },
                  }} />
                {isOver && (
                  <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                    You are allocated beyond your weekly capacity.
                  </Typography>
                )}
              </Box>

              {projectChips.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    Allocated to
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {projectChips.map((p, i) => (
                      <Chip key={i} label={p} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 22 }} />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={7} lg={8}>
          {/* What this role can do */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
            <Typography fontWeight={700} sx={{ mb: 0.5 }}>Access level</Typography>
            <Typography variant="body2" color="text.secondary">{role.blurb}</Typography>
          </Paper>

          {/* Projects managed (managers/admins) */}
          {(user.role === 'manager' || user.role === 'admin') && (
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
              <Box sx={{ px: 3, py: 2 }}>
                <Typography fontWeight={700}>Projects I manage ({myProjects.length})</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                      <TableCell>Project</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>Deadline</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading
                      ? <TableRow><TableCell colSpan={4}><Skeleton variant="text" /></TableCell></TableRow>
                      : myProjects.length === 0
                      ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          You are not set as manager on any project yet.
                        </TableCell></TableRow>
                      : myProjects.map(p => (
                          <TableRow key={p.id} hover sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/projects/${p.id}`)}>
                            <TableCell><Typography fontWeight={600} fontSize="0.85rem">{p.name}</Typography></TableCell>
                            <TableCell><StatusChip value={p.status} /></TableCell>
                            <TableCell sx={{ minWidth: 110 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress variant="determinate" value={p.completion_percentage || 0}
                                  sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                                    '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }} />
                                <Typography variant="caption">{p.completion_percentage || 0}%</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                              {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* My deliverables */}
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ px: 3, py: 2 }}>
              <Typography fontWeight={700}>My deliverables ({myDeliverables.length})</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                    <TableCell>Deliverable</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Progress</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading
                    ? <TableRow><TableCell colSpan={5}><Skeleton variant="text" /></TableCell></TableRow>
                    : myDeliverables.length === 0
                    ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Nothing assigned to you right now.
                      </TableCell></TableRow>
                    : myDeliverables.map(d => (
                        <TableRow key={d.id} hover>
                          <TableCell><Typography fontWeight={600} fontSize="0.85rem">{d.name}</Typography></TableCell>
                          <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{d.project_name || '—'}</TableCell>
                          <TableCell><StatusChip value={d.status} /></TableCell>
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
        </Grid>
      </Grid>
    </Box>
  )
}
