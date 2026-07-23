import { describe, it, expect } from 'vitest'
import {
  dependencyOf, dependentsOf, isBlocked, blockReason,
  canProgress, completionBlockReason, wouldCreateCycle,
  validDependencyOptions, buildChains, blockedCount, isStandalone,
  inconsistentItems,
} from '../utils/dependencies'

//  spec ─── build ─── audit
//              └───── testing
const spec    = { id: 'a', project_id: 'p1', name: 'Design system', status: 'completed',   completion_percentage: 100, depends_on: null }
const build   = { id: 'b', project_id: 'p1', name: 'Portal UI',     status: 'in_progress', completion_percentage: 65,  depends_on: 'a' }
const audit   = { id: 'c', project_id: 'p1', name: 'Accessibility', status: 'pending',     completion_percentage: 0,   depends_on: 'b' }
const testing = { id: 'd', project_id: 'p1', name: 'QA sweep',      status: 'pending',     completion_percentage: 0,   depends_on: 'b' }
const loose   = { id: 'e', project_id: 'p1', name: 'Write release notes', status: 'pending', completion_percentage: 0, depends_on: null }
const all = [spec, build, audit, testing, loose]

describe('resolving links between deliverables', () => {
  it('finds what a deliverable waits on', () => {
    expect(dependencyOf(build, all).name).toBe('Design system')
    expect(dependencyOf(spec, all)).toBeNull()
  })

  it('finds what waits on a deliverable', () => {
    expect(dependentsOf(build, all).map(d => d.name)).toEqual(['Accessibility', 'QA sweep'])
    expect(dependentsOf(loose, all)).toEqual([])
  })
})

describe('work is blocked while its predecessor is unfinished', () => {
  it('is not blocked when the predecessor is complete', () => {
    expect(isBlocked(build, all)).toBe(false)
  })

  it('is blocked when the predecessor is still running', () => {
    expect(isBlocked(audit, all)).toBe(true)
  })

  it('has nothing to block it without a dependency', () => {
    expect(isBlocked(loose, all)).toBe(false)
  })

  it('explains what it is waiting for', () => {
    expect(blockReason(audit, all)).toContain('Portal UI')
    expect(blockReason(audit, all)).toContain('65%')
  })

  it('counts everything currently blocked', () => {
    expect(blockedCount(all)).toBe(2)   // audit and testing
  })
})

describe('finish-to-start: work cannot begin before its predecessor finishes', () => {
  it('allows progress once the predecessor is complete', () => {
    expect(canProgress(build, all)).toBe(true)
  })

  it('refuses progress while the predecessor is unfinished', () => {
    expect(canProgress(audit, all)).toBe(false)
  })

  it('always allows work with no dependency', () => {
    expect(canProgress(loose, all)).toBe(true)
  })

  it('names the blocker when refusing', () => {
    const reason = completionBlockReason(audit, all)
    expect(reason).toMatch(/cannot start/i)
    expect(reason).toContain('Portal UI')
  })

  it('finds records left in an impossible state', () => {
    const broken = { id: 'x', project_id: 'p1', name: 'Jumped the gun',
                     status: 'completed', completion_percentage: 100, depends_on: 'b' }
    const names = inconsistentItems([...all, broken]).map(d => d.name)
    expect(names).toContain('Jumped the gun')
  })
})

describe('a dependency may never form a loop', () => {
  it('refuses to make something depend on itself', () => {
    expect(wouldCreateCycle('a', 'a', all)).toBe(true)
  })

  it('refuses a link back to an ancestor', () => {
    // spec -> build -> audit; audit must not become spec's predecessor
    expect(wouldCreateCycle('a', 'c', all)).toBe(true)
  })

  it('permits an unrelated link', () => {
    expect(wouldCreateCycle('e', 'a', all)).toBe(false)
  })

  it('offers only choices that stay in the project and stay acyclic', () => {
    const options = validDependencyOptions(spec, all).map(d => d.id)
    expect(options).not.toContain('a')   // itself
    expect(options).not.toContain('b')   // would create a loop
    expect(options).toContain('e')
  })

  it('offers nothing before a project is chosen', () => {
    expect(validDependencyOptions({ id: 'z' }, all)).toEqual([])
  })
})

describe('chains show the delivery sequence', () => {
  it('orders a chain from first to last', () => {
    const chains = buildChains(all)
    const longest = chains[0].map(d => d.name)
    expect(longest[0]).toBe('Design system')
    expect(longest).toContain('Portal UI')
  })

  it('never loses a deliverable', () => {
    const total = buildChains(all).flat().length
    expect(total).toBe(all.length)
  })

  it('separates genuinely independent work from parallel branches', () => {
    expect(isStandalone(loose, all)).toBe(true)
    expect(isStandalone(testing, all)).toBe(false)  // depends on build
    expect(isStandalone(spec, all)).toBe(false)     // build depends on it
  })

  it('handles an empty project', () => {
    expect(buildChains([])).toEqual([])
  })
})
