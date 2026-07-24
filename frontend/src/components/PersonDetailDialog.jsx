import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import BadgeIcon from '@mui/icons-material/BadgeRounded'
import EmailIcon from '@mui/icons-material/EmailRounded'
import PhoneIcon from '@mui/icons-material/PhoneRounded'
import PlaceIcon from '@mui/icons-material/PlaceRounded'
import EventIcon from '@mui/icons-material/EventRounded'
import StatusChip from './StatusChip'
import { palette, statusToken, font } from '../theme/tokens'

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const ROLE_BLURB = {
  admin:   'Oversees the platform — accounts, compliance and the support queue.',
  manager: 'Runs projects end to end and allocates the team.',
  member:  'Delivers assigned work and reports progress.',
}

function Line({ icon: LineIcon, label, value, mono }) {
  if (!value) return null
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.6 }}>
      <LineIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.3, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={600}
          sx={{ fontFamily: mono ? font.mono : undefined, wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Everything about one person in a single view: who they are, how loaded they
 * are, and what they are actually working on. Opened from the resource list,
 * because "who is this and what are they doing?" is the question a manager has
 * when scanning a team.
 */
export default function PersonDetailDialog({ person, deliverables = [], projects = [], onClose }) {
  const navigate = useNavigate()

  const theirWork = useMemo(
    () => deliverables.filter(d => d.assigned_to === person?.name),
    [deliverables, person]
  )
  const theirProjects = useMemo(() => {
    if (!person) return []
    return (person.projects || '')
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(entry => {
        const name = entry.replace(/\s*\(\d+h\)/, '')
        const hours = (entry.match(/\((\d+)h\)/) || [])[1]
        return { name, hours, project: projects.find(p => p.name === name) }
      })
  }, [person, projects])

  if (!person) return null

  const cap = Number(person.capacity_hours) || 0
  const alloc = Number(person.allocated_hours) || 0
  const pct = cap > 0 ? Math.round((alloc / cap) * 100) : 0
  const isOver = alloc > cap
  const role = statusToken(person.role)

  return (
    <Dialog open={!!person} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ height: 4, background: `linear-gradient(90deg, ${palette.accent}, ${palette.ink})` }} />

      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2.5 }}>
          <Avatar sx={{ width: 56, height: 56, fontSize: '1.25rem', bgcolor: palette.ink }}>
            {initials(person.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{person.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {person.title || 'No title set'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={person.role}
                sx={{ bgcolor: role.bg, color: role.fg, fontWeight: 700, textTransform: 'capitalize' }} />
              {person.department && <Chip size="small" variant="outlined" label={person.department} />}
              {isOver
                ? <Chip size="small" label="Over-allocated"
                    sx={{ bgcolor: statusToken('blocked').bg, color: statusToken('blocked').fg, fontWeight: 700 }} />
                : pct < 50
                ? <Chip size="small" label="Available"
                    sx={{ bgcolor: statusToken('completed').bg, color: statusToken('completed').fg, fontWeight: 700 }} />
                : null}
            </Box>
          </Box>
        </Box>

        {person.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{person.bio}</Typography>
        )}

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: 'grid', gap: 0, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 2 }}>
          <Line icon={BadgeIcon} label="Employee ID" value={person.employee_id} mono />
          <Line icon={EmailIcon} label="Email" value={person.email} />
          <Line icon={PhoneIcon} label="Phone" value={person.phone} />
          <Line icon={PlaceIcon} label="Location" value={person.location} />
          <Line icon={EventIcon} label="Joined"
            value={person.joined_date ? new Date(person.joined_date).toLocaleDateString() : null} />
        </Box>

        <Typography variant="caption" color="text.secondary">{ROLE_BLURB[person.role]}</Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
          <Typography variant="subtitle2">Weekly allocation</Typography>
          <Typography variant="body2" fontWeight={700} color={isOver ? 'error.main' : 'text.primary'}>
            {alloc}h / {cap}h · {pct}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={Math.min(pct, 100)}
          sx={{ height: 8, '& .MuiLinearProgress-bar': {
            bgcolor: isOver ? statusToken('blocked').dot
                   : pct > 75 ? statusToken('at_risk').dot : statusToken('completed').dot,
          } }} />

        {theirProjects.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.75 }}>On these projects</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {theirProjects.map(tp => (
                <Chip
                  key={tp.name} size="small" variant="outlined"
                  label={tp.hours ? `${tp.name} · ${tp.hours}h` : tp.name}
                  onClick={tp.project ? () => { onClose(); navigate(`/projects/${tp.project.id}`) } : undefined}
                  sx={{ cursor: tp.project ? 'pointer' : 'default' }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Assigned work ({theirWork.length})
        </Typography>
        {theirWork.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing is assigned to {person.name.split(' ')[0]} right now.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Deliverable</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Progress</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {theirWork.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{d.project_name}</Typography>
                    </TableCell>
                    <TableCell><StatusChip value={d.status} /></TableCell>
                    <TableCell align="right">{d.completion_percentage || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
