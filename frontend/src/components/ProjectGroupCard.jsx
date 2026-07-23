import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded'
import { palette, shadow } from '../theme/tokens'

/**
 * A project is the unit people think in, so records are grouped under the
 * project they belong to rather than listed flat. The card face carries enough
 * summary to decide whether to open it; the detail stays out of the way until
 * asked for.
 */
export default function ProjectGroupCard({
  title, subtitle, stats = [], progress, accent, defaultOpen = false, children, count,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Paper sx={{
      overflow: 'hidden', mb: 1.5,
      transition: 'box-shadow .18s ease, border-color .18s ease',
      '&:hover': { boxShadow: shadow.sm },
      ...(open && { borderColor: palette.borderStrong, boxShadow: shadow.sm }),
    }}>
      <Box
        role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, cursor: 'pointer',
          '&:hover': { bgcolor: palette.surfaceAlt },
          '&:focus-visible': { outline: `2px solid ${palette.ink}`, outlineOffset: -2 },
        }}
      >
        {/* Accent spine — colour-codes the project's health at rest */}
        <Box sx={{
          width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
          bgcolor: accent || palette.borderStrong,
        }} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem' }} noWrap>{title}</Typography>
            {count !== undefined && (
              <Box component="span" sx={{
                px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: palette.surfaceAlt,
                border: `1px solid ${palette.border}`,
                fontSize: '0.6875rem', fontWeight: 600, color: palette.inkSubtle,
              }}>
                {count}
              </Box>
            )}
          </Box>
          {subtitle && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>{subtitle}</Typography>
          )}
        </Box>

        {/* Summary figures — readable without opening the card */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, flexShrink: 0 }}>
          {stats.map(s => (
            <Box key={s.label} sx={{ textAlign: 'right', minWidth: 76 }}>
              <Typography sx={{
                fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.2,
                color: s.tone || palette.ink, fontVariantNumeric: 'tabular-nums',
              }}>
                {s.value}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {progress !== undefined && (
          <Box sx={{ width: 90, display: { xs: 'none', lg: 'block' }, flexShrink: 0 }}>
            <LinearProgress variant="determinate" value={Math.min(progress, 100)}
              sx={{ '& .MuiLinearProgress-bar': { bgcolor: accent || palette.ink } }} />
            <Typography variant="caption" sx={{ fontSize: '0.6875rem', display: 'block', textAlign: 'right', mt: 0.5 }}>
              {progress}% complete
            </Typography>
          </Box>
        )}

        <IconButton size="small" sx={{
          flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform .2s ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}>
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={open} timeout={180} unmountOnExit>
        <Divider />
        {children}
      </Collapse>
    </Paper>
  )
}
