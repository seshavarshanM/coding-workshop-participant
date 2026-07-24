import { describe, it, expect } from 'vitest'
import {
  can, canEditProject, canArchiveProject, canManageProjectTeam,
  canEditDeliverable, canDeleteDeliverable, canUpdateProgress,
  canProposeBudget, canEditBudgetEntry, canDeleteBudgetEntry,
  canHire, ownsProject,
} from '../utils/permissions'

const admin   = { name: 'Alice Fernandes', role: 'admin' }
const manager = { name: 'Michael Rao', role: 'manager' }
const other   = { name: 'Daniel Okafor', role: 'manager' }
const member  = { name: 'Sana Kapoor', role: 'member' }

const mine   = { id: 'p1', name: 'Payments API v2', manager: 'Michael Rao' }
const theirs = { id: 'p2', name: 'Cloud Migration', manager: 'Daniel Okafor' }
const projects = [mine, theirs]

const deliverableOnMine = {
  id: 'd1', project_id: 'p1', project_name: 'Payments API v2', assigned_to: 'Sana Kapoor',
}
const budgetOnMine = { id: 'b1', project_id: 'p1', project_name: 'Payments API v2' }

describe('the interface only offers what the API will allow', () => {
  it('refuses everything when nobody is signed in', () => {
    expect(can(null, 'project:create')).toBe(false)
    expect(canEditProject(null, mine)).toBe(false)
    expect(canArchiveProject(null, mine)).toBe(false)
    expect(canHire(null)).toBe(false)
  })
})

describe('administrators oversee the system rather than run projects', () => {
  it('cannot create or edit projects', () => {
    expect(can(admin, 'project:create')).toBe(false)
    expect(canEditProject(admin, mine)).toBe(false)
  })

  it('cannot propose or edit budget', () => {
    expect(canProposeBudget(admin, mine)).toBe(false)
    expect(canEditBudgetEntry(admin, budgetOnMine, projects)).toBe(false)
  })

  it('has no part in a projects lifecycle at all', () => {
    expect(can(admin, 'project:create')).toBe(false)
    expect(canEditProject(admin, mine)).toBe(false)
    expect(canArchiveProject(admin, mine)).toBe(false)
  })

  it('cannot assign work', () => {
    expect(canEditDeliverable(admin, deliverableOnMine, projects)).toBe(false)
    expect(canManageProjectTeam(admin, mine)).toBe(false)
  })

  it('keeps the responsibilities that belong to an administrator', () => {
    expect(canHire(admin)).toBe(true)            // account onboarding
    expect(can(admin, 'person:change-role')).toBe(true)
    expect(can(admin, 'audit:view')).toBe(true)
  })
})

describe('managers act only on the projects they own', () => {
  it('may create projects and edit their own', () => {
    expect(can(manager, 'project:create')).toBe(true)
    expect(canEditProject(manager, mine)).toBe(true)
  })

  it('may not touch another managers project', () => {
    expect(canEditProject(manager, theirs)).toBe(false)
    expect(canManageProjectTeam(manager, theirs)).toBe(false)
    expect(canProposeBudget(manager, theirs)).toBe(false)
  })

  it('may retire a project they own, and only their own', () => {
    // The record is kept and attributed rather than erased — nothing in the
    // application deletes a project permanently.
    expect(canArchiveProject(manager, mine)).toBe(true)
    expect(canArchiveProject(manager, theirs)).toBe(false)
  })

  it('may manage deliverables on their own project only', () => {
    expect(canEditDeliverable(manager, deliverableOnMine, projects)).toBe(true)
    expect(canDeleteDeliverable(manager, deliverableOnMine, projects)).toBe(true)
    const onTheirs = { project_id: 'p2', project_name: 'Cloud Migration' }
    expect(canEditDeliverable(manager, onTheirs, projects)).toBe(false)
  })

  it('may hire into the team', () => {
    expect(canHire(manager)).toBe(true)
  })

  it('may propose and remove budget on their own project', () => {
    expect(canProposeBudget(manager, mine)).toBe(true)
    expect(canDeleteBudgetEntry(manager, budgetOnMine, projects)).toBe(true)
  })
})

describe('members do the work and report on it', () => {
  it('cannot create or edit anything structural', () => {
    expect(can(member, 'project:create')).toBe(false)
    expect(canEditDeliverable(member, deliverableOnMine, projects)).toBe(false)
    expect(canProposeBudget(member, mine)).toBe(false)
    expect(canHire(member)).toBe(false)
  })

  it('may report progress on work assigned to them', () => {
    expect(canUpdateProgress(member, deliverableOnMine, projects)).toBe(true)
  })

  it('may not report progress on someone elses work', () => {
    const someoneElses = { ...deliverableOnMine, assigned_to: 'Omar Haddad' }
    expect(canUpdateProgress(member, someoneElses, projects)).toBe(false)
  })
})

describe('progress reporting follows ownership', () => {
  it('the owning manager may move any item in their project', () => {
    const notTheirs = { ...deliverableOnMine, assigned_to: 'Omar Haddad' }
    expect(canUpdateProgress(manager, notTheirs, projects)).toBe(true)
  })

  it('a manager may not move an item in a project they do not own', () => {
    const onTheirs = { project_id: 'p2', project_name: 'Cloud Migration', assigned_to: 'Omar Haddad' }
    expect(canUpdateProgress(other, onTheirs, projects)).toBe(true)   // Daniel owns p2
    expect(canUpdateProgress(manager, onTheirs, projects)).toBe(false)
  })
})

describe('ownsProject', () => {
  it('is true only for the managing role and matching name', () => {
    expect(ownsProject(manager, mine)).toBe(true)
    expect(ownsProject(manager, theirs)).toBe(false)
    expect(ownsProject(admin, mine)).toBe(false)
    expect(ownsProject(member, mine)).toBe(false)
    expect(ownsProject(manager, null)).toBe(false)
  })
})
