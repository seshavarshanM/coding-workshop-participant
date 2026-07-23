import { describe, it, expect } from 'vitest'
import { isAtRisk, riskReason } from '../utils/risk'

/** A project ending `days` from today, at `pct` complete. */
const project = (days, pct, status = 'active') => ({
  status,
  completion_percentage: pct,
  end_date: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
})

describe('a project is flagged before the deadline arrives, not after', () => {
  it('flags work that is overdue and unfinished', () => {
    expect(isAtRisk(project(-3, 60))).toBe(true)
  })

  it('flags a near deadline with little progress', () => {
    expect(isAtRisk(project(7, 20))).toBe(true)
  })

  it('leaves a near deadline alone when the work is nearly done', () => {
    expect(isAtRisk(project(7, 85))).toBe(false)
  })

  it('leaves a distant deadline alone even at low progress', () => {
    expect(isAtRisk(project(90, 10))).toBe(false)
  })

  it('never flags a completed project, even past its date', () => {
    expect(isAtRisk(project(-30, 100, 'completed'))).toBe(false)
  })

  it('respects a manual at-risk marking', () => {
    expect(isAtRisk(project(180, 95, 'at_risk'))).toBe(true)
  })

  it('does not flag a project with no deadline set', () => {
    expect(isAtRisk({ status: 'active', completion_percentage: 5 })).toBe(false)
  })

  it('handles a missing project safely', () => {
    expect(isAtRisk(null)).toBe(false)
  })
})

describe('the flag explains itself', () => {
  it('says how overdue the work is', () => {
    expect(riskReason(project(-5, 40))).toMatch(/overdue/i)
  })

  it('says how close the deadline is and how far along the work is', () => {
    const reason = riskReason(project(9, 20))
    expect(reason).toMatch(/9 days/i)
    expect(reason).toContain('20%')
  })

  it('reports a manual marking plainly', () => {
    expect(riskReason({ status: 'at_risk' })).toMatch(/marked at risk/i)
  })
})
