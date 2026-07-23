import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Consistent page opening: eyebrow for context, title, one line explaining
 * what this screen is for, and room for a primary action on the right.
 */
export default function PageHeader({ eyebrow, title, description, action, meta }) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 2, flexWrap: 'wrap', mb: 3,
    }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" sx={{ color: 'primary.main', display: 'block', mb: 0.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h5">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
        {meta && <Box sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>{meta}</Box>}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}
