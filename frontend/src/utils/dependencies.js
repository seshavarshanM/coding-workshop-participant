/**
 * Deliverable dependency helpers.
 *
 * A deliverable may depend on another deliverable in the same project: the
 * dependent work cannot legitimately finish until its predecessor is complete.
 * These helpers resolve those links, detect work that is blocked, and order a
 * project's deliverables into chains so the critical path is visible.
 */

/** Resolve the deliverable a given item depends on, if any. */
export function dependencyOf(deliverable, all = []) {
  if (!deliverable?.depends_on) return null
  return all.find(d => d.id === deliverable.depends_on) || null
}

/** Deliverables that depend on this one. */
export function dependentsOf(deliverable, all = []) {
  if (!deliverable?.id) return []
  return all.filter(d => d.depends_on === deliverable.id)
}

/**
 * Work is blocked when its predecessor is not finished.
 * This is derived, not stored: it stays true even if nobody updates a status.
 */
export function isBlocked(deliverable, all = []) {
  const dep = dependencyOf(deliverable, all)
  if (!dep) return false
  if (deliverable.status === 'completed') return false
  return dep.status !== 'completed'
}

export function blockReason(deliverable, all = []) {
  const dep = dependencyOf(deliverable, all)
  if (!dep) return ''
  return `Waiting on "${dep.name}" (${dep.completion_percentage || 0}% complete)`
}

/**
 * Would setting `candidateId` as the dependency of `deliverableId` create a
 * cycle? Walks the chain upward looking for the original item.
 */
export function wouldCreateCycle(deliverableId, candidateId, all = []) {
  if (!deliverableId || !candidateId) return false
  if (deliverableId === candidateId) return true
  const seen = new Set()
  let cursor = all.find(d => d.id === candidateId)
  while (cursor?.depends_on) {
    if (seen.has(cursor.id)) return true       // pre-existing loop
    seen.add(cursor.id)
    if (cursor.depends_on === deliverableId) return true
    cursor = all.find(d => d.id === cursor.depends_on)
  }
  return false
}

/** Valid dependency options: same project, not itself, no cycles. */
export function validDependencyOptions(deliverable, all = []) {
  const projectId = deliverable?.project_id
  if (!projectId) return []
  return all.filter(d =>
    d.project_id === projectId &&
    d.id !== deliverable.id &&
    !wouldCreateCycle(deliverable.id, d.id, all)
  )
}

/**
 * Order a project's deliverables into dependency chains.
 * Returns an array of chains; each chain is an ordered list from the first
 * piece of work to the last thing waiting on it. Items with no links form
 * single-item chains, so nothing is dropped.
 */
export function buildChains(deliverables = []) {
  const byId = new Map(deliverables.map(d => [d.id, d]))
  const hasDependents = new Set(
    deliverables.filter(d => d.depends_on).map(d => d.depends_on)
  )

  // Roots: nothing they depend on (or a dangling reference).
  const roots = deliverables.filter(d => !d.depends_on || !byId.has(d.depends_on))

  const chains = []
  const visited = new Set()

  for (const root of roots) {
    const chain = []
    let cursor = root
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      chain.push(cursor)
      // Follow a single successor; branches start their own chain below.
      const next = deliverables.filter(d => d.depends_on === cursor.id)
      cursor = next.length === 1 ? next[0] : null
      if (next.length > 1) {
        for (const branch of next) {
          if (!visited.has(branch.id)) {
            chains.push(walkFrom(branch, deliverables, visited))
          }
        }
      }
    }
    if (chain.length) chains.push(chain)
  }

  // Anything left (e.g. caught in a cycle) still gets shown.
  for (const d of deliverables) {
    if (!visited.has(d.id)) {
      visited.add(d.id)
      chains.push([d])
    }
  }

  // Longest chains first — the critical path is the most interesting.
  return chains.sort((a, b) => b.length - a.length)
}

function walkFrom(start, deliverables, visited) {
  const chain = []
  let cursor = start
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    chain.push(cursor)
    const next = deliverables.filter(d => d.depends_on === cursor.id)
    cursor = next.length === 1 ? next[0] : null
  }
  return chain
}

/**
 * Finish-to-start: work cannot START until the work it depends on has finished.
 *
 * This is the standard dependency relationship in project planning — if a
 * predecessor is unfinished, the successor should not be recording progress at
 * all, because that progress is not real: it can be invalidated by whatever the
 * predecessor still changes.
 */
export function canProgress(deliverable, all = []) {
  const dep = dependencyOf(deliverable, all)
  if (!dep) return true
  return dep.status === 'completed'
}

/** Kept for clarity at call sites that specifically mean "may it finish?". */
export function canComplete(deliverable, all = []) {
  return canProgress(deliverable, all)
}

/** Explanation for why work cannot proceed yet. */
export function completionBlockReason(deliverable, all = []) {
  const dep = dependencyOf(deliverable, all)
  if (!dep || dep.status === 'completed') return ''
  return `Cannot start: "${dep.name}" must be completed first (currently ${dep.completion_percentage || 0}%)`
}

/**
 * Deliverables in an impossible state: recording progress while their
 * predecessor is unfinished. Usually rows created before the rule existed.
 */
export function inconsistentItems(all = []) {
  return all.filter(d =>
    !canProgress(d, all) && (Number(d.completion_percentage || 0) > 0 || d.status === 'completed')
  )
}

/** True when the item neither depends on anything nor has anything waiting on it. */
export function isStandalone(deliverable, all = []) {
  return !deliverable?.depends_on && dependentsOf(deliverable, all).length === 0
}

/** Count of deliverables currently blocked by an unfinished predecessor. */
export function blockedCount(deliverables = []) {
  return deliverables.filter(d => isBlocked(d, deliverables)).length
}
