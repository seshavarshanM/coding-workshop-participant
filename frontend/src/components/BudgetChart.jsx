import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { palette, statusToken, font } from '../theme/tokens'

const money = n => `$${Number(n || 0).toLocaleString()}`

/**
 * Planned against actual spend, one row per project.
 *
 * Drawn as paired bars rather than a pie: the question is "is this project
 * over or under?", which is a comparison of two lengths — something the eye
 * reads instantly and reads badly as angles. Bars over the plan line are
 * coloured, so overspend is visible without reading a single number.
 */
export default function BudgetChart({ projects = [], entries = [], limit = 6 }) {
  const rows = projects
    .map(p => {
      const mine = entries.filter(e => e.project_id === p.id)
      const planned = mine.reduce((s, e) => s + Number(e.planned_amount || 0), 0)
      const actual = mine.reduce((s, e) => s + Number(e.actual_amount || 0), 0)
      return { id: p.id, name: p.name, planned, actual, over: actual > planned }
    })
    .filter(r => r.planned > 0 || r.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, limit)

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No budget recorded yet.
        </Typography>
      </Box>
    )
  }

  const max = Math.max(...rows.flatMap(r => [r.planned, r.actual])) || 1

  return (
    <Box sx={{ p: 2.5 }}>
      {rows.map(r => {
        const plannedPct = (r.planned / max) * 100
        const actualPct = (r.actual / max) * 100
        const tone = r.over ? statusToken('blocked') : statusToken('completed')
        return (
          <Box key={r.id} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', gap: 1, mb: 0.75 }}>
              <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>{r.name}</Typography>
              <Typography sx={{
                fontFamily: font.mono, fontSize: '0.6875rem', fontWeight: 600,
                whiteSpace: 'nowrap', color: tone.fg,
              }}>
                {money(r.actual)} / {money(r.planned)}
              </Typography>
            </Box>

            {/* Planned sits behind as the reference; actual is drawn over it. */}
            <Tooltip title={`Planned ${money(r.planned)} · Actual ${money(r.actual)}`}>
              <Box sx={{ position: 'relative', height: 18 }}>
                <Box sx={{
                  position: 'absolute', inset: 0, width: `${plannedPct}%`,
                  bgcolor: '#E8E6DF', borderRadius: 0.5,
                }} />
                <Box sx={{
                  position: 'absolute', top: 4, bottom: 4, left: 0, width: `${actualPct}%`,
                  bgcolor: tone.dot, borderRadius: 0.5,
                  transition: 'width .4s ease',
                }} />
                {r.planned > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 0, bottom: 0, left: `${plannedPct}%`,
                    width: '2px', bgcolor: palette.ink, opacity: 0.35,
                  }} />
                )}
              </Box>
            </Tooltip>
          </Box>
        )
      })}

      <Box sx={{ display: 'flex', gap: 2, mt: 2.5, pt: 1.5,
        borderTop: `1px solid ${palette.border}` }}>
        {[['Spent, within plan', statusToken('completed').dot],
          ['Spent, over plan', statusToken('blocked').dot],
          ['Planned', '#E8E6DF']].map(([label, colour]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.25, bgcolor: colour }} />
            <Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
