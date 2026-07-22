import Chip from '@mui/material/Chip'

const STATUS_MAP = {
  // Project statuses
  planning:   { label: 'Planning',    color: '#64748B', bg: '#F1F5F9' },
  active:     { label: 'Active',      color: '#166534', bg: '#DCFCE7' },
  at_risk:    { label: 'At Risk',     color: '#92400E', bg: '#FEF3C7' },
  on_hold:    { label: 'On Hold',     color: '#1E40AF', bg: '#DBEAFE' },
  completed:  { label: 'Completed',   color: '#5B21B6', bg: '#EDE9FE' },
  // Deliverable statuses
  pending:    { label: 'Pending',     color: '#64748B', bg: '#F1F5F9' },
  in_progress:{ label: 'In Progress', color: '#166534', bg: '#DCFCE7' },
  blocked:    { label: 'Blocked',     color: '#991B1B', bg: '#FEE2E2' },
  // Priority
  low:        { label: 'Low',         color: '#166534', bg: '#DCFCE7' },
  medium:     { label: 'Medium',      color: '#92400E', bg: '#FEF3C7' },
  high:       { label: 'High',        color: '#C2410C', bg: '#FFEDD5' },
  critical:   { label: 'Critical',    color: '#991B1B', bg: '#FEE2E2' },
}

export default function StatusChip({ value, size = 'small' }) {
  const cfg = STATUS_MAP[value] || { label: value, color: '#374151', bg: '#F3F4F6' }
  return (
    <Chip
      label={cfg.label}
      size={size}
      sx={{
        fontWeight: 600,
        fontSize: '0.72rem',
        color: cfg.color,
        bgcolor: cfg.bg,
        border: 'none',
      }}
    />
  )
}
