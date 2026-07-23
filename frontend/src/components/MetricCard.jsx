import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import { shadow } from '../theme/tokens'

/**
 * A single number that answers one question. The label states the question in
 * plain words; the footnote gives the context needed to act on it.
 */
export default function MetricCard({ label, value, footnote, tone = 'neutral', progress, Icon }) {
  const TONE = {
    neutral:  { fg: '#0C111D', accent: '#98A2B3' },
    positive: { fg: '#027A48', accent: '#12B76A' },
    warning:  { fg: '#B54708', accent: '#F79009' },
    critical: { fg: '#B42318', accent: '#F04438' },
    accent:   { fg: '#4F46E5', accent: '#6366F1' },
  }[tone]

  return (
    <Paper sx={{ p: 2.5, height: '100%', transition: 'box-shadow .18s ease',
      '&:hover': { boxShadow: shadow.sm } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
        {Icon && <Icon sx={{ fontSize: 17, color: TONE.accent }} />}
      </Box>

      <Typography sx={{
        fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em',
        lineHeight: 1.1, color: TONE.fg,
      }}>
        {value}
      </Typography>

      {progress !== undefined && (
        <LinearProgress variant="determinate" value={Math.min(progress, 100)}
          sx={{ mt: 1.5, '& .MuiLinearProgress-bar': { backgroundColor: TONE.accent } }} />
      )}

      {footnote && (
        <Typography variant="caption" sx={{ display: 'block', mt: progress !== undefined ? 1 : 0.75 }}>
          {footnote}
        </Typography>
      )}
    </Paper>
  )
}
