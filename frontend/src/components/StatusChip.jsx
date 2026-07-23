import Box from '@mui/material/Box'
import { statusToken } from '../theme/tokens'

const LABEL = {
  planning: 'Planning', active: 'Active', at_risk: 'At risk', on_hold: 'On hold',
  completed: 'Completed', pending: 'Pending', in_progress: 'In progress', blocked: 'Blocked',
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
  admin: 'Admin', manager: 'Manager', member: 'Member',
}

/**
 * Status is the most important signal in this interface, so it gets a
 * consistent treatment everywhere: a coloured dot carries the meaning at a
 * glance, the label confirms it. The dot also keeps states distinguishable
 * for anyone who can't rely on colour alone.
 */
export default function StatusChip({ value, size = 'small' }) {
  const t = statusToken(value)
  const label = LABEL[value] || value
  const small = size === 'small'

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: small ? 0.875 : 1.125,
        py: small ? 0.25 : 0.5,
        borderRadius: 1,
        bgcolor: t.bg,
        color: t.fg,
        fontSize: small ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{
        width: 6, height: 6, borderRadius: '50%', bgcolor: t.dot, flexShrink: 0,
      }} />
      {label}
    </Box>
  )
}
