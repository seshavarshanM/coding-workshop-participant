import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { palette, statusToken } from '../theme/tokens'

const ORDER = ['completed', 'in_progress', 'blocked', 'pending']
const LABEL = {
  completed: 'Completed', in_progress: 'In progress',
  blocked: 'Blocked', pending: 'Not started',
}

/**
 * Where the work stands, as a proportion.
 *
 * A ring works here because the parts genuinely sum to a whole — every
 * deliverable is in exactly one state — and because the useful reading is
 * "how much of this is done", not a precise comparison between slices.
 */
export default function DeliveryDonut({ deliverables = [], blockedIds = new Set() }) {
  const counts = ORDER.reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
  for (const d of deliverables) {
    // Derived blocking wins over the stored status: a deliverable waiting on
    // unfinished work is blocked whatever its record says.
    const key = blockedIds.has(d.id) ? 'blocked'
      : ORDER.includes(d.status) ? d.status : 'pending'
    counts[key] += 1
  }

  const total = deliverables.length
  if (total === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No deliverables yet.</Typography>
      </Box>
    )
  }

  const size = 132
  const stroke = 18
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  // Each arc starts where the previous one ended, so the running total is
  // carried through the fold rather than held in a mutable counter.
  const { segments } = ORDER.filter(k => counts[k] > 0).reduce(
    (acc, key) => {
      const dash = (counts[key] / total) * circumference
      acc.segments.push({ key, colour: statusToken(key).dot, dash, offset: acc.offset })
      return { segments: acc.segments, offset: acc.offset + dash }
    },
    { segments: [], offset: 0 }
  )

  const donePct = Math.round((counts.completed / total) * 100)

  return (
    <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#EFEEEA" strokeWidth={stroke} />
          {segments.map(seg => (
            <circle
              key={seg.key}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={seg.colour} strokeWidth={stroke}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset}
            />
          ))}
        </svg>
        <Box sx={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          textAlign: 'center',
        }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
              {donePct}%
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.625rem' }}>complete</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 130 }}>
        {ORDER.map(key => (
          <Box key={key} sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 0.5,
            opacity: counts[key] ? 1 : 0.4,
          }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%',
              bgcolor: statusToken(key).dot, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1 }}>{LABEL[key]}</Typography>
            <Typography variant="subtitle2">{counts[key]}</Typography>
          </Box>
        ))}
        <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${palette.border}`,
          display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption">Total</Typography>
          <Typography variant="subtitle2">{total}</Typography>
        </Box>
      </Box>
    </Box>
  )
}
