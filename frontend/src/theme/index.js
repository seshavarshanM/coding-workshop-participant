import { createTheme } from '@mui/material/styles'
import { palette, shadow, radius } from './tokens'

/**
 * Global theme. Component defaults are set here rather than repeated as `sx`
 * props across pages, so the whole interface stays consistent and pages carry
 * layout logic only.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: palette.accent, dark: palette.accentHover, light: palette.accentSoft },
    secondary: { main: '#7A5AF8' },
    background:{ default: palette.canvas, paper: palette.surface },
    text:      { primary: palette.ink, secondary: palette.inkMuted, disabled: palette.inkFaint },
    divider:   palette.border,
    error:     { main: '#D92D20' },
    warning:   { main: '#DC6803' },
    success:   { main: '#079455' },
    info:      { main: '#175CD3' },
  },

  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Tighter tracking as size increases — headings read as considered, not shouty
    h4: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 },
    h5: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.018em', lineHeight: 1.3 },
    h6: { fontSize: '1.0625rem', fontWeight: 650, letterSpacing: '-0.012em', lineHeight: 1.4 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.006em' },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45, color: palette.inkSubtle },
    button: { fontWeight: 600, letterSpacing: '0' },
    // Eyebrow labels above sections
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.4 },
  },

  shape: { borderRadius: radius.md },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: palette.canvas, WebkitFontSmoothing: 'antialiased' },
        '::selection': { background: palette.accentSoft },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${palette.border}`,
          borderRadius: radius.lg,
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: radius.md,
          padding: '8px 14px',
          fontSize: '0.875rem',
          transition: 'background-color .15s ease, border-color .15s ease, box-shadow .15s ease',
        },
        contained: {
          boxShadow: shadow.xs,
          '&:hover': { boxShadow: shadow.sm },
        },
        outlined: {
          borderColor: palette.borderStrong,
          color: palette.inkMuted,
          '&:hover': { borderColor: palette.inkFaint, backgroundColor: palette.surfaceAlt },
        },
        sizeSmall: { padding: '5px 10px', fontSize: '0.8125rem' },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.sm, fontWeight: 600, fontSize: '0.75rem', height: 24 },
        sizeSmall: { height: 22, fontSize: '0.6875rem' },
        outlined: { borderColor: palette.border },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: palette.surfaceAlt,
            color: palette.inkSubtle,
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${palette.border}`,
            paddingTop: 10,
            paddingBottom: 10,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: palette.border,
          fontSize: '0.875rem',
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .12s ease',
          '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
        },
        hover: { '&:hover': { backgroundColor: palette.surfaceAlt } },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          fontSize: '0.9375rem',
          '& fieldset': { borderColor: palette.borderStrong },
          '&:hover fieldset': { borderColor: palette.inkFaint },
          '&.Mui-focused fieldset': { borderWidth: 1, borderColor: palette.accent },
        },
        input: { padding: '10px 12px' },
      },
    },

    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    MuiFormHelperText: { styleOverrides: { root: { fontSize: '0.75rem', marginLeft: 2 } } },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.xl, boxShadow: shadow.lg, border: 'none' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1.0625rem', fontWeight: 650, letterSpacing: '-0.012em', padding: '20px 24px' },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '20px 24px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px' } } },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.md, fontSize: '0.8125rem', border: '1px solid transparent' },
        standardInfo:    { backgroundColor: '#EFF8FF', color: '#175CD3', borderColor: '#B2DDFF' },
        standardWarning: { backgroundColor: '#FFFAEB', color: '#B54708', borderColor: '#FEDF89' },
        standardError:   { backgroundColor: '#FEF3F2', color: '#B42318', borderColor: '#FECDCA' },
        standardSuccess: { backgroundColor: '#ECFDF3', color: '#027A48', borderColor: '#ABEFC6' },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 999, backgroundColor: '#EAECF0' },
        bar: { borderRadius: 999 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: palette.ink,
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: radius.sm,
          padding: '6px 10px',
        },
        arrow: { color: palette.ink },
      },
    },

    MuiAvatar: { styleOverrides: { root: { fontWeight: 600, fontSize: '0.8125rem' } } },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: radius.sm, '&:hover': { backgroundColor: palette.surfaceAlt } },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: palette.border } } },
  },
})

export default theme
