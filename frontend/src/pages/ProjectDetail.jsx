import { useState, useEffect } from 'react'
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PersonIcon from '@mui/icons-material/Person'
import BusinessIcon from '@mui/icons-material/Business'
import { projectService } from '../services/projectService'
import { deliverableService } from '../services/deliverableService'
import { budgetService } from '../services/budgetService'
import StatusChip from '../components/StatusChip'

function InfoRow({ icon: Icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
      <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [deliverables, setDeliverables] = useState([])
  const [budget, setBudget] = useState({ entries: [], summary: { total_planned: 0, total_actual: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      projectService.getById(id),
      deliverableService.getAll({ project_id: id }),
      budgetService.getAll({ project_id: id }),
    ])
      .then(([p, d, b]) => {
        setProject(p)
        setDeliverables(d)
        setBudget(b || { entries: [], summary: { total_planned: 0, total_actual: 0 } })
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <Box>
      <Skeleton variant="text" width={300} height={40} />
      <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 3 }} />
    </Box>
  )

  if (error) return <Alert severity="error">{error}</Alert>
  if (!project) return <Alert severity="warning">Project not found</Alert>

  const budgetPct = project.budget_planned > 0
    ? Math.round((Number(project.budget_spent) / Number(project.budget_planned)) * 100)
    : 0

  const doneCount = deliverables.filter(d => d.status === 'completed').length
  const totalDels = deliverables.length

  return (
    <Box>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')}
        sx={{ textTransform: 'none', mb: 2, color: 'text.secondary' }}>
        Back to Projects
      </Button>

      {/* Header card */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography variant="h5" fontWeight={800}>{project.name}</Typography>
              <StatusChip value={project.status} size="medium" />
              <StatusChip value={project.priority} size="medium" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
              {project.description || 'No description provided.'}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/projects')}
            sx={{ textTransform: 'none', borderRadius: 2 }}>
            Edit Project
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <InfoRow icon={PersonIcon} label="Manager" value={project.manager} />
            <InfoRow icon={BusinessIcon} label="Department" value={project.department} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoRow icon={CalendarTodayIcon} label="Start" value={project.start_date ? new Date(project.start_date).toLocaleDateString() : null} />
            <InfoRow icon={CalendarTodayIcon} label="Deadline" value={project.end_date ? new Date(project.end_date).toLocaleDateString() : null} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {/* Completion */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Completion</Typography>
                  <Typography variant="caption" fontWeight={700}>{project.completion_percentage || 0}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={project.completion_percentage || 0}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 4 } }}
                />
                <Typography variant="caption" color="text.secondary">
                  {doneCount}/{totalDels} deliverables done
                </Typography>
              </Box>
              {/* Budget */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Budget used</Typography>
                  <Typography variant="caption" fontWeight={700}>{budgetPct}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(budgetPct, 100)}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: budgetPct > 90 ? '#DC2626' : budgetPct > 70 ? '#D97706' : '#16A34A',
                      borderRadius: 4
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  ${Number(project.budget_spent || 0).toLocaleString()} / ${Number(project.budget_planned || 0).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Deliverables */}
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
                          <LinearProgress
                            variant="determinate"
                            value={d.completion_percentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }}
                          />
                          <Typography variant="caption">{d.completion_percentage || 0}%</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Budget entries */}
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
                        <TableCell fontWeight={600} fontSize="0.85rem">{e.category}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>{e.description || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>${Number(e.planned_amount).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>${Number(e.actual_amount).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${variance >= 0 ? '+' : ''}$${variance.toLocaleString()}`}
                            size="small"
                            sx={{
                              fontWeight: 600, fontSize: '0.72rem',
                              color: variance >= 0 ? '#166534' : '#991B1B',
                              bgcolor: variance >= 0 ? '#DCFCE7' : '#FEE2E2',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
              }
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
    </Box>
  )
}
