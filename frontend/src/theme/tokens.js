/**
 * Design tokens for ACME Project Hub.
 *
 * The interface is deliberately quiet: near-neutral surfaces, restrained
 * indigo for interactive elements, and saturated colour reserved almost
 * entirely for status. In a tool whose job is making project health legible,
 * colour has to mean something — so nothing decorative is allowed to compete
 * with a red "at risk" or an amber "blocked".
 */

export const palette = {
  // Surfaces — cool near-white so status colour reads cleanly against it
  canvas:     '#F7F8FA',
  surface:    '#FFFFFF',
  surfaceAlt: '#FBFCFD',
  border:     '#E4E7EC',
  borderStrong: '#D0D5DD',

  // Ink
  ink:        '#0C111D',
  inkMuted:   '#475467',
  inkSubtle:  '#667085',
  inkFaint:   '#98A2B3',

  // Interactive — indigo, used sparingly
  accent:     '#4F46E5',
  accentHover:'#4338CA',
  accentSoft: '#EEF2FF',

  // Navigation shell — deep ink, not black
  navBg:      '#101828',
  navBorder:  'rgba(255,255,255,0.08)',
  navText:    '#94A3B8',
  navTextActive: '#FFFFFF',
  navActiveBg: 'rgba(99,102,241,0.16)',
}

/** Status colours carry meaning — this is the loudest thing in the UI. */
export const status = {
  completed:   { fg: '#027A48', bg: '#ECFDF3', dot: '#12B76A' },
  active:      { fg: '#175CD3', bg: '#EFF8FF', dot: '#2E90FA' },
  in_progress: { fg: '#175CD3', bg: '#EFF8FF', dot: '#2E90FA' },
  at_risk:     { fg: '#B54708', bg: '#FFFAEB', dot: '#F79009' },
  blocked:     { fg: '#B42318', bg: '#FEF3F2', dot: '#F04438' },
  on_hold:     { fg: '#5925DC', bg: '#F4F3FF', dot: '#7A5AF8' },
  planning:    { fg: '#344054', bg: '#F2F4F7', dot: '#98A2B3' },
  pending:     { fg: '#344054', bg: '#F2F4F7', dot: '#98A2B3' },
  // Priority
  low:         { fg: '#027A48', bg: '#ECFDF3', dot: '#12B76A' },
  medium:      { fg: '#B54708', bg: '#FFFAEB', dot: '#F79009' },
  high:        { fg: '#C4320A', bg: '#FFF4ED', dot: '#EF6820' },
  critical:    { fg: '#B42318', bg: '#FEF3F2', dot: '#F04438' },
  // Roles
  admin:       { fg: '#5925DC', bg: '#F4F3FF', dot: '#7A5AF8' },
  manager:     { fg: '#175CD3', bg: '#EFF8FF', dot: '#2E90FA' },
  member:      { fg: '#344054', bg: '#F2F4F7', dot: '#98A2B3' },
}

export function statusToken(value) {
  return status[value] || status.planning
}

/** Layered, low-opacity shadows — depth without heaviness. */
export const shadow = {
  xs: '0 1px 2px rgba(16,24,40,0.05)',
  sm: '0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)',
  md: '0 4px 8px -2px rgba(16,24,40,0.10), 0 2px 4px -2px rgba(16,24,40,0.06)',
  lg: '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)',
}

export const radius = { sm: 6, md: 8, lg: 12, xl: 16 }
