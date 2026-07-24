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
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded'
import FolderIcon from '@mui/icons-material/FolderRounded'
import WarningIcon from '@mui/icons-material/ReportProblemRounded'
import WalletIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PeopleIcon from '@mui/icons-material/GroupsRounded'
import TaskIcon from '@mui/icons-material/TaskAltRounded'
import BlockIcon from '@mui/icons-material/BlockRounded'

import { projectService } from '../services/projectService'
import { budgetService } from '../services/budgetService'
import { deliverableService } from '../services/deliverableService'
import { peopleService } from '../services/peopleService'
import { useAuth } from '../context/AuthContext'
import { isAtRisk, riskReason } from '../utils/risk'
import { isBlocked, blockReason } from '../utils/dependencies'
import StatusChip from '../components/StatusChip'
import PageHeader from '../components/PageHeader'
import MetricCard from '../components/MetricCard'
import BudgetChart from '../components/BudgetChart'
import DeliveryDonut from '../components/DeliveryDonut'
import { palette } from '../theme/tokens'

const money = n => `$${Number(n || 0).toLocaleString()}`
const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const avatarColor = (n = '') =>
  ['#4F46E5', '#7A5AF8', '#0E9384', '#DD2590', '#175CD3', '#B54708'][(n.charCodeAt(0) || 0) % 6]

function Progress({ value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 108 }}>
      <LinearProgress variant="determinate" value={value || 0} sx={{ flex: 1 }} />
      <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value || 0}%
      </Typography>
    </Box>
  )
}

function SectionCard({ title, description, action, children }) {
  return (
    <Paper sx={{ overflow: 'hidden', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1">{title}</Typography>
          {description && <Typography variant="caption">{description}</Typography>}
        </Box>
        {action}
      </Box>
      <Divider />
      {children}
    </Paper>
  )
}

function EmptyState({ children }) {
  return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </Box>
  )
}

function ProjectsTable({ rows, loading, navigate }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Project</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell>Progress</TableCell>
            <TableCell align="right">Deadline</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <TableCell key={j}><Skeleton variant="text" width="70%" /></TableCell>
                ))}</TableRow>
              ))
            : rows.length === 0
            ? <TableRow><TableCell colSpan={5}><EmptyState>Nothing here yet.</EmptyState></TableCell></TableRow>
            : rows.map(p => (
                <TableRow key={p.id} hover sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${p.id}`)}>
                  <TableCell>
                    <Typography variant="subtitle2" noWrap sx={{ maxWidth: 240 }}>{p.name}</Typography>
                    <Typography variant="caption">{p.department}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <StatusChip value={p.status} />
                      {isAtRisk(p) && p.status !== 'at_risk' && (
                        <Tooltip title={riskReason(p)}>
                          <WarningIcon sx={{ fontSize: 15, color: '#F79009' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 22, height: 22, fontSize: '0.625rem',
                        bgcolor: avatarColor(p.manager) }}>
                        {initials(p.manager)}
                      </Avatar>
                      <Typography variant="body2" noWrap>{p.manager || '—'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Progress value={p.completion_percentage} /></TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Ranked list of what needs attention — the reason this dashboard exists. */
function AttentionList({ projects, deliverables, navigate, loading }) {
  if (loading) {
    return <Box sx={{ p: 2.5 }}>{[1,2,3].map(i => <Skeleton key={i} height={38} />)}</Box>
  }

  const atRisk = projects.filter(isAtRisk)
  const blocked = deliverables.filter(d => isBlocked(d, deliverables))

  if (atRisk.length === 0 && blocked.length === 0) {
    return <EmptyState>Nothing needs attention. Every project is on track.</EmptyState>
  }

  return (
    <Box sx={{ p: 1.25 }}>
      {atRisk.slice(0, 4).map(p => (
        <Box key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
          sx={{ display: 'flex', gap: 1.25, p: 1.25, borderRadius: 1.5, cursor: 'pointer',
            '&:hover': { bgcolor: palette.surfaceAlt } }}>
          <WarningIcon sx={{ fontSize: 17, color: '#F79009', mt: 0.25, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>{p.name}</Typography>
            <Typography variant="caption">{riskReason(p)}</Typography>
          </Box>
        </Box>
      ))}
      {blocked.slice(0, 4).map(d => (
        <Box key={d.id} onClick={() => navigate('/deliverables')}
          sx={{ display: 'flex', gap: 1.25, p: 1.25, borderRadius: 1.5, cursor: 'pointer',
            '&:hover': { bgcolor: palette.surfaceAlt } }}>
          <BlockIcon sx={{ fontSize: 17, color: '#F04438', mt: 0.25, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>{d.name}</Typography>
            <Typography variant="caption">{blockReason(d, deliverables)}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [budget, setBudget] = useState({ total_planned: 0, total_actual: 0 })
  const [budgetEntries, setBudgetEntries] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      projectService.getAll(), budgetService.getAll(),
      deliverableService.getAll(), peopleService.getAll(),
    ])
      .then(([p, b, d, r]) => {
        setProjects(p)
        if (b?.summary) setBudget(b.summary)
        setBudgetEntries(b?.entries || [])
        setDeliverables(d); setPeople(r)
      })
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return <Alert severity="warning" sx={{ mt: 2 }}>Could not load dashboard data: {error}</Alert>
  }

  const firstName = user?.name?.split(' ')[0] || ''

  // ── MEMBER ──────────────────────────────────────────────────────────
  if (user?.role === 'member') {
    const mine = deliverables.filter(d => d.assigned_to === user.name)
    const done = mine.filter(d => d.status === 'completed').length
    const blocked = mine.filter(d => isBlocked(d, deliverables)).length
    const upcoming = mine.filter(d => d.status !== 'completed' && d.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

    return (
      <Box>
        <PageHeader eyebrow="My work" title={`Good to see you, ${firstName}`}
          description="Everything currently assigned to you, soonest first." />

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Assigned to me" value={loading ? '—' : mine.length}
              footnote={`${done} completed`} Icon={TaskIcon} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Still open" value={loading ? '—' : upcoming.length}
              footnote="Not yet finished" tone="accent" Icon={FolderIcon} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Waiting on others" value={loading ? '—' : blocked}
              footnote={blocked ? 'A dependency is unfinished' : 'Nothing is blocked'}
              tone={blocked ? 'critical' : 'positive'} Icon={BlockIcon} />
          </Grid>
        </Grid>

        <SectionCard title="What's next" description="Your deliverables by due date"
          action={<Button size="small" endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/deliverables')}>See all</Button>}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Deliverable</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell align="right">Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcoming.length === 0
                  ? <TableRow><TableCell colSpan={5}>
                      <EmptyState>Nothing open right now.</EmptyState></TableCell></TableRow>
                  : upcoming.map(d => (
                      <TableRow key={d.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="subtitle2">{d.name}</Typography>
                            {isBlocked(d, deliverables) && (
                              <Tooltip title={blockReason(d, deliverables)}>
                                <BlockIcon sx={{ fontSize: 14, color: '#F04438' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{d.project_name || '—'}</Typography></TableCell>
                        <TableCell><StatusChip value={d.status} /></TableCell>
                        <TableCell><Progress value={d.completion_percentage} /></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(d.due_date).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Box>
    )
  }

  // ── MANAGER ─────────────────────────────────────────────────────────
  const isManager = user?.role === 'manager'
  const scope = isManager ? projects.filter(p => p.manager === user.name) : projects
  const scopedNames = new Set(scope.map(p => p.name))
  const scopedDeliverables = isManager
    ? deliverables.filter(d => scopedNames.has(d.project_name))
    : deliverables

  const active = scope.filter(p => p.status === 'active').length
  const atRiskCount = scope.filter(isAtRisk).length
  const blockedCount = scopedDeliverables.filter(d => isBlocked(d, deliverables)).length
  const planned = Number(budget.total_planned) || 0
  const actual = Number(budget.total_actual) || 0
  const budgetPct = planned > 0 ? Math.round((actual / planned) * 100) : 0

  const capacity = people.reduce((s, r) => s + Number(r.capacity_hours || 0), 0)
  const allocated = people.reduce((s, r) => s + Number(r.allocated_hours || 0), 0)
  const utilisation = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0
  const overAllocated = people.filter(r => Number(r.allocated_hours) > Number(r.capacity_hours)).length

  return (
    <Box>
      <PageHeader
        eyebrow={isManager ? 'My portfolio' : 'Organisation'}
        title={isManager ? `Good to see you, ${firstName}` : 'Portfolio overview'}
        description={isManager
          ? 'Projects you own, and what needs your attention today.'
          : 'Delivery, capacity and spend across every department.'}
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label={isManager ? 'My projects' : 'Projects'}
            value={loading ? '—' : scope.length}
            footnote={`${active} active`} Icon={FolderIcon} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Needs attention" value={loading ? '—' : atRiskCount}
            footnote={atRiskCount ? 'Behind schedule or overdue' : 'All on track'}
            tone={atRiskCount ? 'warning' : 'positive'} Icon={WarningIcon} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Budget used" value={`${budgetPct}%`} progress={budgetPct}
            footnote={`${money(actual)} of ${money(planned)}`}
            tone={budgetPct > 90 ? 'critical' : budgetPct > 75 ? 'warning' : 'accent'}
            Icon={WalletIcon} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard label="Team utilisation" value={`${utilisation}%`} progress={utilisation}
            footnote={overAllocated ? `${overAllocated} over capacity` : 'Capacity is healthy'}
            tone={overAllocated ? 'critical' : 'positive'} Icon={PeopleIcon} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <SectionCard
            title={isManager ? 'My projects' : 'All projects'}
            description="Ordered by most recently created"
            action={<Button size="small" endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/projects')}>See all</Button>}>
            <ProjectsTable rows={scope.slice(0, 6)} loading={loading} navigate={navigate} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <SectionCard title="Needs attention"
            description={`${atRiskCount} at risk · ${blockedCount} blocked`}>
            <AttentionList projects={scope} deliverables={scopedDeliverables}
              navigate={navigate} loading={loading} />
          </SectionCard>
        </Grid>

        {/* Two questions the numbers alone answer poorly: is spend tracking to
            plan, and how much of the work is actually done. */}
        <Grid item xs={12} lg={7}>
          <SectionCard title="Spend against plan"
            description="Actual spend compared with what was budgeted"
            action={<Button size="small" endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/budget')}>Budget</Button>}>
            {loading
              ? <Box sx={{ p: 2.5 }}>{[1,2,3].map(i => <Skeleton key={i} height={38} />)}</Box>
              : <BudgetChart projects={scope} entries={budgetEntries} />}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <SectionCard title="Delivery status"
            description="Where the work stands across these projects"
            action={<Button size="small" endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/deliverables')}>Deliverables</Button>}>
            {loading
              ? <Box sx={{ p: 2.5 }}><Skeleton variant="circular" width={132} height={132} /></Box>
              : <DeliveryDonut
                  deliverables={scopedDeliverables}
                  blockedIds={new Set(
                    scopedDeliverables.filter(d => isBlocked(d, deliverables)).map(d => d.id)
                  )}
                />}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
