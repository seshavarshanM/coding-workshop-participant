import { createTheme } from '@mui/material/styles'
import { palette, shadow, radius, font } from './tokens'

/**
 * Global theme. Component defaults live here so pages carry layout logic only.
 *
 * Type has two jobs: headings use a transitional serif to give the tool some
 * authority, while every number and label uses IBM Plex with tabular figures so
 * columns of data line up and stay scannable.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: palette.accent, dark: palette.accentHover,
                 light: palette.accentSoft, contrastText: palette.ink },
    secondary: { main: palette.ink },
    background:{ default: palette.canvas, paper: palette.surface },
    text:      { primary: palette.ink, secondary: palette.inkMuted, disabled: palette.inkFaint },
    divider:   palette.border,
    error:     { main: '#C0332A' },
    warning:   { main: '#EA580C' },
    success:   { main: '#1F9254' },
    info:      { main: '#2C6FD1' },
  },

  typography: {
    fontFamily: font.body,
    // Serif display sizes — set tight, they carry the page's authority
    h4: { fontFamily: font.display, fontSize: '1.875rem', fontWeight: 600,
          letterSpacing: '-0.015em', lineHeight: 1.2 },
    h5: { fontFamily: font.display, fontSize: '1.5rem', fontWeight: 600,
          letterSpacing: '-0.012em', lineHeight: 1.25 },
    h6: { fontFamily: font.display, fontSize: '1.125rem', fontWeight: 600,
          letterSpacing: '-0.008em', lineHeight: 1.35 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.003em' },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45, color: palette.inkSubtle },
    button: { fontWeight: 600, letterSpacing: '0.005em' },
    overline: { fontFamily: font.body, fontSize: '0.6875rem', fontWeight: 600,
                letterSpacing: '0.09em', lineHeight: 1.4 },
  },

  shape: { borderRadius: radius.md },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Nothing may be wider than the screen. MUI's Grid deliberately
        // overhangs its container by the gutter width, which is invisible on a
        // desktop but spills off the side of a phone. Guarding at the root is
        // more reliable than correcting each layout that uses it.
        'html, body, #root': {
          maxWidth: '100%',
          overflowX: 'hidden',
        },
        '*, *::before, *::after': { boxSizing: 'border-box' },
        // Long unbroken strings (emails, IDs) wrap rather than widening a card.
        // Scoped to headings and body copy so table cells keep their own rules.
        'h1, h2, h3, h4, h5, h6, p': { overflowWrap: 'break-word' },
        body: {
          backgroundColor: palette.canvas,
          WebkitFontSmoothing: 'antialiased',
          // Numbers align in columns wherever they appear
          fontVariantNumeric: 'tabular-nums',
        },
        '::selection': { background: palette.accent, color: palette.ink },
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
          textTransform: 'none', borderRadius: radius.md,
          padding: '8px 14px', fontSize: '0.875rem',
          transition: 'background-color .15s ease, border-color .15s ease, box-shadow .15s ease',
        },
        contained: {
          backgroundColor: palette.accent, color: palette.ink,
          boxShadow: shadow.xs,
          '&:hover': { backgroundColor: palette.accentHover, boxShadow: shadow.sm },
        },
        outlined: {
          borderColor: palette.borderStrong, color: palette.ink,
          '&:hover': { borderColor: palette.ink, backgroundColor: palette.surfaceAlt },
        },
        text: { color: palette.inkMuted, '&:hover': { backgroundColor: palette.surfaceAlt } },
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
            fontWeight: 600, fontSize: '0.6875rem',
            letterSpacing: '0.07em', textTransform: 'uppercase',
            borderBottom: `1px solid ${palette.border}`,
            paddingTop: 10, paddingBottom: 10,
          },
        },
      },
    },

    // A wide table should scroll inside its own card rather than pushing
    // the whole page sideways on a narrow screen.
    MuiTableContainer: {
      styleOverrides: {
        root: {
          maxWidth: '100%',
          overflowX: 'auto',
          // Momentum scrolling so a wide table feels native on touch
          WebkitOverflowScrolling: 'touch',
        },
      },
    },

    // A table keeps a workable width and scrolls inside its container rather
    // than compressing columns until the text breaks one letter per line.
    MuiTable: {
      styleOverrides: { root: { minWidth: 560 } },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: palette.border, fontSize: '0.875rem',
          paddingTop: 12, paddingBottom: 12,
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
          borderRadius: radius.md, backgroundColor: palette.surface, fontSize: '0.9375rem',
          '& fieldset': { borderColor: palette.borderStrong },
          '&:hover fieldset': { borderColor: palette.inkFaint },
          '&.Mui-focused fieldset': { borderWidth: 2, borderColor: palette.ink },
        },
        input: { padding: '10px 12px' },
      },
    },

    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    MuiFormHelperText: { styleOverrides: { root: { fontSize: '0.75rem', marginLeft: 2 } } },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderBottom: `1px solid ${palette.border}` },
        indicator: { height: 2, backgroundColor: palette.ink },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', minHeight: 40, fontSize: '0.875rem', fontWeight: 600,
          color: palette.inkSubtle, padding: '8px 14px',
          '&.Mui-selected': { color: palette.ink },
        },
      },
    },

    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radius.xl, boxShadow: shadow.lg, border: 'none' } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: font.display, fontSize: '1.125rem', fontWeight: 600,
                letterSpacing: '-0.008em', padding: '20px 24px' },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '20px 24px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px' } } },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.md, fontSize: '0.8125rem', border: '1px solid transparent' },
        standardInfo:    { backgroundColor: '#E9F0FA', color: '#1B4B8F', borderColor: '#C3D7F0' },
        standardWarning: { backgroundColor: '#FDEEE4', color: '#9C3A06', borderColor: '#F7CDB0' },
        standardError:   { backgroundColor: '#FBEAE8', color: '#93231C', borderColor: '#F2C4C0' },
        standardSuccess: { backgroundColor: '#E8F5EC', color: '#15633C', borderColor: '#B9E0C8' },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 2, backgroundColor: '#E8E6DF' },
        bar: { borderRadius: 2 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: palette.ink, fontSize: '0.75rem', fontWeight: 500,
                   borderRadius: radius.sm, padding: '6px 10px' },
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
    MuiAccordion: {
      styleOverrides: {
        root: { border: `1px solid ${palette.border}`, borderRadius: radius.lg,
                '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } },
      },
    },
  },
})

export default theme
