import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import PrintIcon from '@mui/icons-material/PrintRounded'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import { projectService } from '../services/projectService'
import { deliverableService } from '../services/deliverableService'
import { budgetService } from '../services/budgetService'
import { peopleService } from '../services/peopleService'
import { isAtRisk, riskReason } from '../utils/risk'
import { isBlocked, blockReason, buildChains } from '../utils/dependencies'
import { palette, font, statusToken } from '../theme/tokens'

const money = n => `$${Number(n || 0).toLocaleString()}`
const date = d => (d ? new Date(d).toLocaleDateString(undefined,
  { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 4, breakInside: 'avoid' }}>
      <Typography sx={{
        fontFamily: font.body, fontSize: '0.6875rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: palette.inkSubtle, pb: 0.75, mb: 1.5,
        borderBottom: `1px solid ${palette.border}`,
      }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function Field({ label, value }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: palette.inkSubtle, mb: 0.125 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{value || '—'}</Typography>
    </Box>
  )
}

/**
 * A status report a manager can hand to a stakeholder.
 *
 * Rendered as a document rather than an app screen, and printed through the
 * browser — which produces a clean PDF on every platform without shipping a
 * PDF library or asking the server to render anything.
 */
export default function ProjectReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [deliverables, setDeliverables] = useState([])
  const [budget, setBudget] = useState({ entries: [], summary: {} })
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      projectService.getById(id),
      deliverableService.getAll({ project_id: id }),
      budgetService.getAll({ project_id: id }),
      peopleService.getAll(),
    ])
      .then(([p, d, b, r]) => { setProject(p); setDeliverables(d); setBudget(b); setPeople(r) })
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Box><Skeleton height={40} width={320} /><Skeleton height={220} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>
  if (!project) return <Alert severity="warning">Project not found</Alert>

  const done = deliverables.filter(d => d.status === 'completed').length
  const blocked = deliverables.filter(d => isBlocked(d, deliverables))
  const completion = deliverables.length
    ? Math.round(deliverables.reduce((s, d) => s + Number(d.completion_percentage || 0), 0) / deliverables.length)
    : Number(project.completion_percentage || 0)
  const planned = Number(budget.summary?.total_planned || 0)
  const actual = Number(budget.summary?.total_actual || 0)
  const team = people.filter(p => {
    const list = (p.projects || '').split(',').map(x => x.trim())
    return list.some(e => e === project.name || e.startsWith(`${project.name} (`))
  })
  const chains = buildChains(deliverables).filter(c => c.length > 1)
  const atRisk = isAtRisk(project)

  return (
    <Box>
      {/* Controls — hidden when printing */}
      <Box className="no-print" sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/projects/${id}`)}>
          Back to project
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </Box>

      <Box sx={{
        bgcolor: '#fff', border: `1px solid ${palette.border}`, borderRadius: 2,
        p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto',
        '@media print': {
          border: 'none', borderRadius: 0, p: 0,
          maxWidth: 'none', width: '100%', margin: 0,
        },
      }}>
        {/* Masthead */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          pb: 2.5, mb: 3.5, borderBottom: `2px solid ${palette.ink}` }}>
          <Box>
            <Typography sx={{ fontFamily: font.body, fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.inkSubtle }}>
              ACME Inc · Project status report
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.75 }}>{project.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
              {project.description || 'No description provided.'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 3 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: palette.inkSubtle }}>Reported</Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>
        </Box>

        {/* Headline judgement first — a stakeholder reads one line */}
        <Box sx={{
          p: 2, mb: 4, borderRadius: 1.5,
          bgcolor: atRisk ? statusToken('at_risk').bg : statusToken('completed').bg,
          border: `1px solid ${atRisk ? statusToken('at_risk').dot : statusToken('completed').dot}`,
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem',
            color: atRisk ? statusToken('at_risk').fg : statusToken('completed').fg }}>
            {atRisk ? 'Needs attention' : 'On track'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25,
            color: atRisk ? statusToken('at_risk').fg : statusToken('completed').fg }}>
            {atRisk
              ? riskReason(project)
              : `${completion}% complete with ${deliverables.length - done} deliverable(s) remaining.`}
            {blocked.length > 0 && ` ${blocked.length} deliverable(s) blocked by an unfinished dependency.`}
          </Typography>
        </Box>

        <Section title="Summary">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Field label="Status" value={project.status?.replace('_', ' ')} />
            <Field label="Priority" value={project.priority} />
            <Field label="Manager" value={project.manager} />
            <Field label="Department" value={project.department} />
            <Field label="Start" value={date(project.start_date)} />
            <Field label="Deadline" value={date(project.end_date)} />
            <Field label="Completion" value={`${completion}%`} />
            <Field label="Team size" value={`${team.length} people`} />
          </Box>
        </Section>

        <Section title={`Deliverables (${done} of ${deliverables.length} complete)`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Deliverable</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell align="right">Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliverables.length === 0
                ? <TableRow><TableCell colSpan={5}>No deliverables recorded.</TableCell></TableRow>
                : deliverables.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.name}
                        {isBlocked(d, deliverables) && (
                          <Typography variant="caption" sx={{ display: 'block', color: statusToken('blocked').fg }}>
                            {blockReason(d, deliverables)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{d.assigned_to || '—'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{d.status?.replace('_', ' ')}</TableCell>
                      <TableCell align="right">{date(d.due_date)}</TableCell>
                      <TableCell align="right">{d.completion_percentage || 0}%</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Section>

        {chains.length > 0 && (
          <Section title="Delivery sequence">
            {chains.map((chain, i) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.75 }}>
                {chain.map(c => `${c.name} (${c.completion_percentage || 0}%)`).join('  →  ')}
              </Typography>
            ))}
          </Section>
        )}

        <Section title="Budget">
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
            <Field label="Approved budget" value={money(project.budget_planned)} />
            <Field label="Committed" value={money(planned)} />
            <Field label="Spent to date" value={money(actual)} />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Planned</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(budget.entries || []).length === 0
                ? <TableRow><TableCell colSpan={5}>No budget recorded.</TableCell></TableRow>
                : budget.entries.map(e => {
                    const v = Number(e.planned_amount) - Number(e.actual_amount)
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{e.category}</TableCell>
                        <TableCell>{e.description || '—'}</TableCell>
                        <TableCell align="right">{money(e.planned_amount)}</TableCell>
                        <TableCell align="right">{money(e.actual_amount)}</TableCell>
                        <TableCell align="right" sx={{
                          color: v >= 0 ? statusToken('completed').fg : statusToken('blocked').fg }}>
                          {v >= 0 ? '+' : '−'}{money(Math.abs(v))}
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </Section>

        <Section title={`Team (${team.length})`}>
          {team.length === 0
            ? <Typography variant="body2" color="text.secondary">No one is allocated to this project.</Typography>
            : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Allocation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {team.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.title}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell align="right">{p.allocated_hours}h / {p.capacity_hours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </Section>

        <Typography variant="caption" sx={{ display: 'block', mt: 4, pt: 2,
          borderTop: `1px solid ${palette.border}`, color: palette.inkFaint }}>
          Generated from ACME Project Hub · Figures reflect data recorded at the time of printing.
        </Typography>
      </Box>
    </Box>
  )
}
