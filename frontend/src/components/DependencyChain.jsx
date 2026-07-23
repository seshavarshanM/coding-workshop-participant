import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { buildChains, isBlocked, blockReason, isStandalone } from '../utils/dependencies'

const STATUS_COLOR = {
  completed:   { border: '#16A34A', bg: '#F0FDF4', bar: '#16A34A' },
  in_progress: { border: '#1565C0', bg: '#EFF6FF', bar: '#1565C0' },
  blocked:     { border: '#DC2626', bg: '#FEF2F2', bar: '#DC2626' },
  pending:     { border: '#CBD5E1', bg: '#F8FAFC', bar: '#94A3B8' },
}

function Node({ item, all }) {
  const blocked = isBlocked(item, all)
  const key = blocked ? 'blocked' : (item.status in STATUS_COLOR ? item.status : 'pending')
  const c = STATUS_COLOR[key]
  const pct = item.completion_percentage || 0

  const card = (
    <Paper
      elevation={0}
      sx={{
        p: 1.5, borderRadius: 2, minWidth: 190, maxWidth: 230, flexShrink: 0,
        border: '1px solid', borderColor: c.border, bgcolor: c.bg,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.75 }}>
        {item.status === 'completed'
          ? <CheckCircleIcon sx={{ fontSize: 15, color: '#16A34A', mt: 0.2, flexShrink: 0 }} />
          : blocked
          ? <BlockIcon sx={{ fontSize: 15, color: '#DC2626', mt: 0.2, flexShrink: 0 }} />
          : null}
        <Typography fontSize="0.8rem" fontWeight={600} lineHeight={1.25}>
          {item.name}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {item.assigned_to || 'Unassigned'}
      </Typography>

      <LinearProgress
        variant="determinate" value={pct}
        sx={{ height: 5, borderRadius: 3, bgcolor: '#E2E8F0',
          '& .MuiLinearProgress-bar': { bgcolor: c.bar, borderRadius: 3 } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{pct}%</Typography>
        {blocked && (
          <Chip label="Blocked" size="small"
            sx={{ height: 17, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#FEE2E2', color: '#991B1B' }} />
        )}
      </Box>
    </Paper>
  )

  return blocked
    ? <Tooltip title={blockReason(item, all)} arrow>{card}</Tooltip>
    : card
}

/**
 * Visualises how deliverables depend on one another, so it is obvious which
 * piece of work is holding up everything downstream.
 */
export default function DependencyChain({ deliverables = [] }) {
  if (deliverables.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No deliverables yet — add some to map out the delivery sequence.
        </Typography>
      </Box>
    )
  }

  const chains = buildChains(deliverables)
  const linked = chains.filter(c => c.length > 1)
  // A one-item chain is not necessarily independent — it may be a branch off a
  // shared predecessor. Only items with no links either way are standalone.
  const loose = chains.filter(c => c.length === 1).flat()
  const standalone = loose.filter(d => isStandalone(d, deliverables))
  const branches = loose.filter(d => !isStandalone(d, deliverables))

  return (
    <Box sx={{ p: 2.5 }}>
      {linked.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No dependencies set yet. Edit a deliverable and choose what it
          “depends on” to map the sequence.
        </Typography>
      )}

      {linked.map((chain, i) => (
        <Box key={i} sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ display: 'block', mb: 1, letterSpacing: '0.4px' }}>
            {i === 0 ? `LONGEST CHAIN · ${chain.length} STEPS` : `CHAIN ${i + 1} · ${chain.length} STEPS`}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', pb: 1 }}>
            {chain.map((item, idx) => (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Node item={item} all={deliverables} />
                {idx < chain.length - 1 && (
                  <ArrowForwardIcon sx={{ fontSize: 18, color: '#94A3B8', flexShrink: 0 }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      {branches.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ display: 'block', mb: 1, letterSpacing: '0.4px' }}>
            PARALLEL BRANCHES · SHARE A PREDECESSOR
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {branches.map(item => <Node key={item.id} item={item} all={deliverables} />)}
          </Box>
        </Box>
      )}

      {standalone.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ display: 'block', mb: 1, letterSpacing: '0.4px' }}>
            INDEPENDENT · NO DEPENDENCIES
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {standalone.map(item => <Node key={item.id} item={item} all={deliverables} />)}
          </Box>
        </Box>
      )}
    </Box>
  )
}
