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

/**
 * Ownership rule for deliverables: a manager may edit a deliverable only when
 * it belongs to a project they manage. Admin may edit any.
 * `projects` is the full project list so we can resolve the deliverable's owner.
 */
export function canEditDeliverable(user, deliverable, projects = []) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'manager') return false
  const parent = projects.find(
    p => p.id === deliverable.project_id || p.name === deliverable.project_name
  )
  return !!parent && parent.manager === user.name
}

/** Same ownership rule for deleting a deliverable. */
export function canDeleteDeliverable(user, deliverable, projects = []) {
  return canEditDeliverable(user, deliverable, projects)
}

/**
 * Who may update status/completion on a deliverable.
 *  - admin:   any deliverable
 *  - manager: only deliverables on projects they manage, or ones assigned to them
 *  - member:  only deliverables assigned to them
 * `projects` is required for the manager ownership check.
 */
export function canUpdateProgress(user, deliverable, projects = []) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'manager') {
    return canEditDeliverable(user, deliverable, projects)
      || deliverable.assigned_to === user.name
  }
  return can(user, 'deliverable:update-progress')
    && deliverable.assigned_to === user.name
}

/**
 * Team assignment on a project: admin anywhere, manager only on their own project.
 */
export function canManageProjectTeam(user, project) {
  if (!user || !project) return false
  if (user.role === 'admin') return true
  return user.role === 'manager' && project.manager === user.name
}
