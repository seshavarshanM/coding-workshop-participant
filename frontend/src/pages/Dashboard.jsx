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
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { projectService } from '../services/projectService'
import { budgetService } from '../services/budgetService'
import StatusChip from '../components/StatusChip'

function KPICard({ title, value, sub, Icon, color, bg }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3, borderRadius: 3,
        border: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'flex-start', gap: 2,
      }}
    >
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: bg }}>
        <Icon sx={{ color, fontSize: 24 }} />
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>
          {title}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [budget, setBudget] = useState({ total_planned: 0, total_actual: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      projectService.getAll(),
      budgetService.getAll(),
    ])
      .then(([p, b]) => {
        setProjects(Array.isArray(p) ? p : [])
        if (b?.summary) setBudget(b.summary)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const total     = projects.length
  const active    = projects.filter(p => p.status === 'active').length
  const atRisk    = projects.filter(p => p.status === 'at_risk').length
  const completed = projects.filter(p => p.status === 'completed').length
  const budgetPct = budget.total_planned > 0
    ? Math.round((Number(budget.total_actual) / Number(budget.total_planned)) * 100)
    : 0

  const recent = [...projects].slice(0, 8)

  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Could not load dashboard data: {error}. Make sure the backend is running.
      </Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time overview of all ACME projects
        </Typography>
      </Box>

      {/* KPI row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Total Projects', value: loading ? '—' : total,     sub: 'All time',         Icon: FolderOpenIcon,           color: '#1565C0', bg: '#DBEAFE' },
          { title: 'Active',         value: loading ? '—' : active,    sub: `${completed} completed`, Icon: CheckCircleOutlineIcon,   color: '#166534', bg: '#DCFCE7' },
          { title: 'At Risk',        value: loading ? '—' : atRisk,    sub: 'Need attention',   Icon: WarningAmberIcon,         color: '#92400E', bg: '#FEF3C7' },
          { title: 'Budget Used',    value: loading ? '—' : `${budgetPct}%`, sub: `$${Number(budget.total_actual).toLocaleString()} of $${Number(budget.total_planned).toLocaleString()}`, Icon: AttachMoneyIcon, color: '#5B21B6', bg: '#EDE9FE' },
        ].map(k => (
          <Grid item xs={12} sm={6} lg={3} key={k.title}>
            <KPICard {...k} />
          </Grid>
        ))}
      </Grid>

      {/* Recent projects table */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Recent Projects</Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/projects')}
            sx={{ textTransform: 'none' }}
          >
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
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : recent.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No projects yet. <Button size="small" onClick={() => navigate('/projects')}>Create one →</Button>
                      </TableCell>
                    </TableRow>
                  )
                : recent.map(p => (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.85rem">{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.department}</Typography>
                      </TableCell>
                      <TableCell><StatusChip value={p.status} /></TableCell>
                      <TableCell><StatusChip value={p.priority} /></TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{p.manager || '—'}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={p.completion_percentage || 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }}
                          />
                          <Typography variant="caption" sx={{ minWidth: 32 }}>
                            {p.completion_percentage || 0}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                        {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
