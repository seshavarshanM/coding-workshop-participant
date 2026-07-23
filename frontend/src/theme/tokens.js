/**
 * Design tokens — ACME Project Hub.
 *
 * Direction: industrial rather than software-startup. Black chassis, warm
 * off-white paper, and a single signal yellow used only where the interface
 * wants a decision from you. The reference points are instrument panels and
 * trading terminals, not consumer dashboards.
 *
 * One deliberate constraint: brand yellow appears ONLY in navigation, primary
 * actions and the wordmark. Status colour is never yellow, so a warning can
 * never be mistaken for chrome.
 */

export const palette = {
  // Paper — warm off-white so the yellow reads as gold rather than acid
  canvas:       '#FAF9F6',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F6F5F1',
  border:       '#E3E1DA',
  borderStrong: '#CFCCC2',

  // Ink
  ink:        '#16161A',
  inkMuted:   '#4A4A52',
  inkSubtle:  '#6E6E77',
  inkFaint:   '#9A9AA2',

  // Signal yellow — the single brand accent
  accent:      '#FFC53D',
  accentHover: '#F0B420',
  accentSoft:  '#FFF6DF',
  accentInk:   '#7A5B00',   // accessible yellow-family text on light surfaces

  // Navigation chassis
  navBg:         '#16161A',
  navBorder:     'rgba(255,255,255,0.08)',
  navText:       '#9A9AA2',
  navTextActive: '#16161A',
  navActiveBg:   '#FFC53D',
}

/**
 * Status colours. Deliberately no yellow here — the brand owns yellow, so
 * "at risk" is orange and stays unmistakable next to the chrome.
 */
export const status = {
  completed:   { fg: '#15633C', bg: '#E8F5EC', dot: '#1F9254' },
  active:      { fg: '#1B4B8F', bg: '#E9F0FA', dot: '#2C6FD1' },
  in_progress: { fg: '#1B4B8F', bg: '#E9F0FA', dot: '#2C6FD1' },
  at_risk:     { fg: '#9C3A06', bg: '#FDEEE4', dot: '#EA580C' },
  blocked:     { fg: '#93231C', bg: '#FBEAE8', dot: '#D6342A' },
  on_hold:     { fg: '#4A4A52', bg: '#EFEEEA', dot: '#8A8A93' },
  planning:    { fg: '#4A4A52', bg: '#EFEEEA', dot: '#B4B2AA' },
  pending:     { fg: '#4A4A52', bg: '#EFEEEA', dot: '#B4B2AA' },
  low:         { fg: '#15633C', bg: '#E8F5EC', dot: '#1F9254' },
  medium:      { fg: '#9C3A06', bg: '#FDEEE4', dot: '#EA580C' },
  high:        { fg: '#93231C', bg: '#FBEAE8', dot: '#D6342A' },
  critical:    { fg: '#FFFFFF', bg: '#93231C', dot: '#FF8A80' },
  admin:       { fg: '#16161A', bg: '#FFF0C4', dot: '#FFC53D' },
  manager:     { fg: '#1B4B8F', bg: '#E9F0FA', dot: '#2C6FD1' },
  member:      { fg: '#4A4A52', bg: '#EFEEEA', dot: '#B4B2AA' },
}

export function statusToken(value) {
  return status[value] || status.planning
}

/** Shadows are warm-tinted to sit correctly on off-white paper. */
export const shadow = {
  xs: '0 1px 2px rgba(22,22,26,0.05)',
  sm: '0 1px 3px rgba(22,22,26,0.09), 0 1px 2px rgba(22,22,26,0.05)',
  md: '0 4px 10px -2px rgba(22,22,26,0.09), 0 2px 4px -2px rgba(22,22,26,0.05)',
  lg: '0 14px 20px -6px rgba(22,22,26,0.10), 0 4px 8px -3px rgba(22,22,26,0.04)',
}

export const radius = { sm: 4, md: 6, lg: 8, xl: 12 }

/** Type roles — a transitional serif for authority, Plex for data. */
export const font = {
  display: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
  body:    '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono:    '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
}
