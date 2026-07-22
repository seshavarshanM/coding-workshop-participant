/**
 * Role-Based Access Control — single source of truth.
 *
 * Roles: admin > manager > member
 *  - admin:   governs the platform (all actions, incl. destructive ones)
 *  - manager: runs projects (create/edit, but no deletes of projects/people)
 *  - member:  does the work (read-only + self-report progress on own deliverables)
 */

const MATRIX = {
  admin: '*', // everything

  manager: new Set([
    'project:create', 'project:edit',
    'deliverable:create', 'deliverable:edit', 'deliverable:delete',
    'deliverable:update-progress',
    'resource:edit',          // can adjust allocations, not add/remove people
    'budget:create', 'budget:edit',
  ]),

  member: new Set([
    'deliverable:update-progress',  // only on deliverables assigned to them
  ]),
}

export function can(user, action) {
  if (!user) return false
  const perms = MATRIX[user.role]
  if (perms === '*') return true
  return perms ? perms.has(action) : false
}

/** Member can self-report only on their own items. */
export function canUpdateProgress(user, deliverable) {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'manager') return true
  return can(user, 'deliverable:update-progress')
    && deliverable.assigned_to === user.name
}
