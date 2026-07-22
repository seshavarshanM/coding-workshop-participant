/**
 * Auto risk detection — a project is "at risk" when:
 *  - manually marked at_risk, OR
 *  - past its deadline and not completed, OR
 *  - deadline within 14 days but completion below 70%
 */
export function isAtRisk(p) {
  if (!p || p.status === 'completed') return false
  if (p.status === 'at_risk') return true
  if (!p.end_date) return false
  const days = (new Date(p.end_date) - new Date()) / 86400000
  if (days < 0) return true
  return days <= 14 && Number(p.completion_percentage || 0) < 70
}

export function riskReason(p) {
  if (p.status === 'at_risk') return 'Marked at risk'
  if (!p.end_date) return ''
  const days = Math.ceil((new Date(p.end_date) - new Date()) / 86400000)
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  return `Due in ${days} day${days === 1 ? '' : 's'} at only ${p.completion_percentage || 0}% complete`
}
