/**
 * Presentation for the project detail screen.
 *
 * Styles live beside the component but outside it, so the component file reads
 * as behaviour — load the project, work out what is blocked, decide who may
 * edit — rather than a wall of layout objects. Anything that depends on data
 * (a colour that changes with budget health) is a function of that data.
 */
import { palette, shadow, statusToken } from '../../theme/tokens'

export const page = {
  backLink: { textTransform: 'none', mb: 2, color: 'text.secondary' },
}

export const header = {
  card: { mb: 2, overflow: 'hidden' },
  accentStrip: {
    height: 4,
    background: `linear-gradient(90deg, ${palette.accent}, ${palette.ink})`,
  },
  body: { p: 3 },
  titleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexWrap: 'wrap', gap: 2,
  },
  titleGroup: { display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' },
  description: { maxWidth: 600 },
  infoRow: { display: 'flex', flexWrap: 'wrap', gap: 4, mb: 3 },
  actions: { display: 'flex', gap: 1 },
}

export const infoItem = {
  wrapper: { minWidth: 130 },
  label: { display: 'block', mb: 0.25 },
}

export const progress = {
  labelRow: { display: 'flex', justifyContent: 'space-between', mb: 0.5 },
  bar: { height: 8, borderRadius: 4 },
}

/** Budget health reads red as it approaches the ceiling. */
export const budgetBar = (usedPercent) => ({
  ...progress.bar,
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
    bgcolor: usedPercent > 90 ? statusToken('blocked').dot
           : usedPercent > 70 ? statusToken('at_risk').dot
           : statusToken('completed').dot,
  },
})

export const section = {
  card: { mb: 2 },
  head: {
    px: 3, py: 2, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 1, flexWrap: 'wrap',
  },
  emptyState: { py: 4, textAlign: 'center' },
}

export const team = {
  list: { p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 },
  member: {
    display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
    borderRadius: 1.5, bgcolor: palette.surfaceAlt,
    transition: 'box-shadow .15s ease',
    '&:hover': { boxShadow: shadow.xs },
  },
  avatar: (color) => ({ width: 34, height: 34, fontSize: '0.8rem', bgcolor: color }),
  hoursChip: {
    fontWeight: 700, fontSize: '0.6875rem',
    bgcolor: palette.accentSoft, color: palette.accentInk,
  },
}

export const table = {
  progressCell: { minWidth: 110 },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 1 },
  mutedCell: { color: 'text.secondary' },
  totalRow: { bgcolor: palette.surfaceAlt },
}

/** Variance is the number people scan for, so it carries the colour. */
export const varianceChip = (value) => ({
  fontWeight: 600, fontSize: '0.72rem',
  color: value >= 0 ? statusToken('completed').fg : statusToken('blocked').fg,
  bgcolor: value >= 0 ? statusToken('completed').bg : statusToken('blocked').bg,
})

export const assignDialog = {
  memberOption: {
    display: 'flex', justifyContent: 'space-between',
    width: '100%', alignItems: 'center', gap: 1,
  },
  capacityChip: (remaining, utilisation) => ({
    fontWeight: 700, fontSize: '0.6875rem',
    bgcolor: remaining === 0 ? statusToken('blocked').bg
           : utilisation < 50 ? statusToken('completed').bg
           : statusToken('at_risk').bg,
    color:   remaining === 0 ? statusToken('blocked').fg
           : utilisation < 50 ? statusToken('completed').fg
           : statusToken('at_risk').fg,
  }),
}
