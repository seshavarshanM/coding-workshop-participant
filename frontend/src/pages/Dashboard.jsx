import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import { projectService } from '../services/projectService'
import { budgetService } from '../services/budgetService'
import { deliverableService } from '../services/deliverableService'
import { resourceService } from '../services/resourceService'
import { useAuth } from '../context/AuthContext'
import StatusChip from '../components/StatusChip'
import { isAtRisk } from '../utils/risk'

function KPICard({ title, value, sub, Icon, color, bg }) {
  return (
    <Paper elevation={0}
      sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: bg }}>
        <Icon sx={{ color, fontSize: 24 }} />
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>{title}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </Box>
    </Paper>
  )
}

function ProjectsTable({ rows, loading, navigate, title = 'Recent Projects' }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography fontWeight={700}>{title}</Typography>
        <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')} sx={{ textTransform: 'none' }}>
          View all
        </Button>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Deadline</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                  ))}</TableRow>
                ))
              : rows.length === 0
              ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No projects to show.
                </TableCell></TableRow>
              : rows.map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                    <TableCell>
                      <Typography fontWeight={600} fontSize="0.85rem">{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.department}</Typography>
                    </TableCell>
                    <TableCell><StatusChip value={p.status} /></TableCell>
                    <TableCell><StatusChip value={p.priority} /></TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{p.manager || '—'}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={p.completion_percentage || 0}
                          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }} />
                        <Typography variant="caption" sx={{ minWidth: 32 }}>{p.completion_percentage || 0}%</Typography>
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
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [budget, setBudget] = useState({ total_planned: 0, total_actual: 0 })
  const [deliverables, setDeliverables] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      projectService.getAll(),
      budgetService.getAll(),
      deliverableService.getAll(),
      resourceService.getAll(),
    ])
      .then(([p, b, d, r]) => {
        setProjects(p)
        if (b?.summary) setBudget(b.summary)
        setDeliverables(d)
        setResources(r)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return <Alert severity="warning" sx={{ mt: 2 }}>Could not load dashboard data: {error}</Alert>
  }

  // ════════════════════════ MEMBER VIEW ════════════════════════
  // Their assigned deliverables and what's due soon.
  if (user?.role === 'member') {
    const mine = deliverables.filter(d => d.assigned_to === user.name)
    const done = mine.filter(d => d.status === 'completed').length
    const inProgress = mine.filter(d => d.status === 'in_progress').length
    const upcoming = [...mine]
      .filter(d => d.status !== 'completed' && d.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>My Work</Typography>
          <Typography variant="body2" color="text.secondary">
            Hello {user.name.split(' ')[0]} — here's what's on your plate
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <KPICard title="My Deliverables" value={loading ? '—' : mine.length} sub="Assigned to me"
              Icon={AssignmentIcon} color="#1565C0" bg="#DBEAFE" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KPICard title="In Progress" value={loading ? '—' : inProgress} sub={`${done} completed`}
              Icon={CheckCircleOutlineIcon} color="#166534" bg="#DCFCE7" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KPICard title="Due Soon" value={loading ? '—' : upcoming.length} sub="Not yet completed"
              Icon={WarningAmberIcon} color="#92400E" bg="#FEF3C7" />
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight={700}>My Upcoming Deliverables</Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/deliverables')} sx={{ textTransform: 'none' }}>
              All deliverables
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', bgcolor: '#F8FAFC' } }}>
                  <TableCell>Deliverable</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Progress</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcoming.length === 0
                  ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nothing pending — all caught up! 🎉
                    </TableCell></TableRow>
                  : upcoming.map(d => (
                      <TableRow key={d.id} hover>
                        <TableCell><Typography fontWeight={600} fontSize="0.85rem">{d.name}</Typography></TableCell>
                        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{d.project_name || '—'}</TableCell>
                        <TableCell><StatusChip value={d.status} /></TableCell>
                        <TableCell sx={{ fontSize: '0.82rem' }}>
                          {new Date(d.due_date).toLocaleDateString()}
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
      </Box>
    )
  }

  // ════════════════════════ MANAGER VIEW ════════════════════════
  // Scoped to projects they manage (matched by manager name).
  if (user?.role === 'manager') {
    const myProjects = projects.filter(p => p.manager === user.name)
    const scope = myProjects.length > 0 ? myProjects : projects  // fallback: show all with note
    const scoped = myProjects.length > 0
    const active = scope.filter(p => p.status === 'active').length
    const atRisk = scope.filter(isAtRisk).length
    const myProjectNames = new Set(scope.map(p => p.name))
    const teamDeliverables = deliverables.filter(d => myProjectNames.has(d.project_name))
    const overdue = teamDeliverables.filter(d =>
      d.status !== 'completed' && d.due_date && new Date(d.due_date) < new Date()).length

    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>Manager Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {scoped
              ? `Projects managed by ${user.name}`
              : `No projects have you as manager yet — showing all projects. Set "Manager" to "${user.name}" on your projects to scope this view.`}
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard title="My Projects" value={loading ? '—' : scope.length} sub={scoped ? 'Managed by me' : 'All projects'}
              Icon={FolderOpenIcon} color="#1565C0" bg="#DBEAFE" />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard title="Active" value={loading ? '—' : active} sub="In flight"
              Icon={CheckCircleOutlineIcon} color="#166534" bg="#DCFCE7" />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard title="At Risk" value={loading ? '—' : atRisk} sub="Incl. auto-detected"
              Icon={WarningAmberIcon} color="#92400E" bg="#FEF3C7" />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard title="Overdue Deliverables" value={loading ? '—' : overdue} sub="Past due, not complete"
              Icon={AssignmentIcon} color="#991B1B" bg="#FEE2E2" />
          </Grid>
        </Grid>

        <ProjectsTable rows={scope.slice(0, 8)} loading={loading} navigate={navigate}
          title={scoped ? 'My Projects' : 'All Projects'} />
      </Box>
    )
  }

  // ════════════════════════ ADMIN VIEW ════════════════════════
  // Org-wide: everything, including resource utilization.
  const total = projects.length
  const active = projects.filter(p => p.status === 'active').length
  const atRisk = projects.filter(isAtRisk).length
  const completed = projects.filter(p => p.status === 'completed').length
  const budgetPct = budget.total_planned > 0
    ? Math.round((Number(budget.total_actual) / Number(budget.total_planned)) * 100) : 0
  const overAllocated = resources.filter(r => Number(r.allocated_hours) > Number(r.capacity_hours)).length
  const totalCapacity = resources.reduce((s, r) => s + Number(r.capacity_hours || 0), 0)
  const totalAllocated = resources.reduce((s, r) => s + Number(r.allocated_hours || 0), 0)
  const utilization = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Organization Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Org-wide view across all departments and projects
          </Typography>
        </Box>
        <Chip label="ADMIN" size="small" sx={{ fontWeight: 700, bgcolor: '#EDE9FE', color: '#5B21B6' }} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard title="Total Projects" value={loading ? '—' : total} sub={`${active} active · ${completed} completed`}
            Icon={FolderOpenIcon} color="#1565C0" bg="#DBEAFE" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard title="At Risk" value={loading ? '—' : atRisk} sub="Incl. auto-detected"
            Icon={WarningAmberIcon} color="#92400E" bg="#FEF3C7" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard title="Budget Used" value={loading ? '—' : `${budgetPct}%`}
            sub={`$${Number(budget.total_actual).toLocaleString()} of $${Number(budget.total_planned).toLocaleString()}`}
            Icon={AttachMoneyIcon} color="#5B21B6" bg="#EDE9FE" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard title="Team Utilization" value={loading ? '—' : `${utilization}%`}
            sub={overAllocated > 0 ? `⚠ ${overAllocated} over-allocated` : 'Capacity healthy'}
            Icon={PeopleAltIcon} color={overAllocated > 0 ? '#991B1B' : '#166534'}
            bg={overAllocated > 0 ? '#FEE2E2' : '#DCFCE7'} />
        </Grid>
      </Grid>

      <ProjectsTable rows={[...projects].slice(0, 8)} loading={loading} navigate={navigate} />
    </Box>
  )
}
