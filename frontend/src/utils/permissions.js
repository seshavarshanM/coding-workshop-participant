/**
 * Role-Based Access Control — mirrors the rules enforced by the backend.
 *
 * These checks decide what the UI *shows*. They are a usability layer, not the
 * security boundary: every action is independently authorised server-side in
 * each service's auth module. Keeping both in step avoids offering a button that
 * the API will reject.
 *
 * admin   — system administrator. Sees everything, manages accounts, performs
 *           compliance deletions and reviews the audit trail. Deliberately NOT
 *           a business actor: does not create projects, propose budgets or
 *           assign work.
 * manager — the primary business actor. Owns projects end to end, proposes
 *           budgets, manages deliverables and hires team members. Scoped to the
 *           projects they manage.
 * member  — does the work; reports progress on their own deliverables.
 */

const MATRIX = {
  admin: new Set([
    'project:delete',      // compliance removal
    'person:create',       // account onboarding
    'person:edit',
    'person:delete',
    'person:change-role',
    'audit:view',
  ]),

  manager: new Set([
    'project:create', 'project:edit',
    'deliverable:create', 'deliverable:edit', 'deliverable:delete',
    'deliverable:update-progress',
    'budget:propose', 'budget:edit', 'budget:delete',
    'person:create',       // hiring
    'person:edit',
    'team:assign',
    'audit:view-own',
  ]),

  member: new Set([
    'deliverable:update-progress',
  ]),
}

export function can(user, action) {
  if (!user) return false
  const perms = MATRIX[user.role]
  return perms ? perms.has(action) : false
}

/** Everyone signed in can read the portfolio. */
export function canView(user) {
  return !!user
}

/** Managers act only on the projects they own; admins never act on business data. */
export function ownsProject(user, project) {
  if (!user || !project) return false
  return user.role === 'manager' && project.manager === user.name
}

export function canEditProject(user, project) {
  return can(user, 'project:edit') && ownsProject(user, project)
}

export function canDeleteProject(user) {
  return can(user, 'project:delete')     // administrator only
}

export function canManageProjectTeam(user, project) {
  return can(user, 'team:assign') && ownsProject(user, project)
}

function parentProject(deliverable, projects = []) {
  return projects.find(
    p => p.id === deliverable.project_id || p.name === deliverable.project_name
  )
}

export function canEditDeliverable(user, deliverable, projects = []) {
  if (!can(user, 'deliverable:edit')) return false
  return ownsProject(user, parentProject(deliverable, projects))
}

export function canDeleteDeliverable(user, deliverable, projects = []) {
  if (!can(user, 'deliverable:delete')) return false
  return ownsProject(user, parentProject(deliverable, projects))
}

/**
 * Who may move status/completion:
 *  - the owning manager, on any deliverable in their project
 *  - the assignee, on their own work
 */
export function canUpdateProgress(user, deliverable, projects = []) {
  if (!user) return false
  if (canEditDeliverable(user, deliverable, projects)) return true
  return can(user, 'deliverable:update-progress')
    && deliverable.assigned_to === user.name
}

export function canProposeBudget(user, project) {
  return can(user, 'budget:propose') && ownsProject(user, project)
}

export function canEditBudgetEntry(user, entry, projects = []) {
  if (!can(user, 'budget:edit')) return false
  return ownsProject(user, parentProject(entry, projects))
}

export function canDeleteBudgetEntry(user, entry, projects = []) {
  if (!can(user, 'budget:delete')) return false
  return ownsProject(user, parentProject(entry, projects))
}

/** Managers hire into their teams; admins onboard accounts. */
export function canHire(user) {
  return can(user, 'person:create')
}

/** Explanation shown to admins where a business action would normally appear. */
export const ADMIN_READONLY_NOTE =
  'Administrators oversee the system. Creating projects, proposing budgets and ' +
  'assigning work are project manager responsibilities.'
