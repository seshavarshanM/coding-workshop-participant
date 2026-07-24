# Role-based access control

Three roles, and the split is the most consequential design decision in the
application.

- **Administrator** runs the platform. Accounts, compliance, the audit trail,
  the support queue.
- **Manager** runs the work. Owns projects end to end, and is scoped to the
  ones they own.
- **Member** does the work. Reports progress on what is assigned to them.

The point: **privilege and responsibility are separate axes.** An administrator
with the highest access is deliberately *not* able to make delivery decisions,
because those belong to whoever is accountable for the delivery.

---

## Who can do what

A tick means allowed; **own** means only for projects that person manages.

| Action | Admin | Manager | Member |
|---|:--:|:--:|:--:|
| **Projects** ||||
| View all projects | ✅ | ✅ | ✅ |
| Create a project | ❌ | ✅ | ❌ |
| Edit a project | ❌ | **own** | ❌ |
| Retire a project | ❌ | **own** | ❌ |
| **Deliverables** ||||
| View all deliverables | ✅ | ✅ | ✅ |
| Create a deliverable | ❌ | **own** | ❌ |
| Edit / delete a deliverable | ❌ | **own** | ❌ |
| Set a dependency | ❌ | **own** | ❌ |
| Report progress | ❌ | **own** | assigned to them |
| **Budget** ||||
| View budget | ✅ | ✅ | ✅ |
| Propose an entry | ❌ | **own** | ❌ |
| Edit an entry | ❌ | **own** | ❌ |
| Remove an entry | ❌ | **own** | ❌ |
| **People** ||||
| View the team | ✅ | ✅ | ✅ |
| Hire someone | ✅ | ✅ | ❌ |
| Edit a person's details | ✅ | ✅ | own profile |
| Change someone's role | ✅ | ❌ | ❌ |
| Remove an account | ✅ | ❌ | ❌ |
| Assign to a project team | ✅ | **own** | ❌ |
| **Platform** ||||
| Full activity log | ✅ | own actions | ❌ |
| Support queue | triage | raise | raise |

### Why the unusual entries

**An administrator cannot touch projects at all.**
Not create, not edit, not retire. Those are delivery decisions, and an
administrator who can do everything makes the role meaningless — it puts project
decisions with whoever holds the highest access rather than whoever is
accountable for the delivery.

**A project's whole lifecycle belongs to its manager.**
Creating, editing and retiring — all of it. An administrator has no part in it,
because none of those are administrative decisions.

**Nothing is ever permanently deleted.**
Retiring a project removes it from the active list but keeps the record, marked
with who retired it and when. A project that consumed budget and people is part
of the organisation's history, and erasing it would lose exactly what the audit
trail exists to preserve. The same applies to budget entries.

**A manager can hire, but cannot change a role or remove an account.**
Hiring adds capacity to a team, which is a delivery decision. Granting someone
administrator rights, or removing their access entirely, is account
administration.

**A member updates progress only on their own work.**
And they cannot reassign it or move its deadline — the restricted dialog only
exposes status and completion.

---

## How it shows in the interface

The rule is that **the interface never offers a control the API would reject.**
Both read the same matrix, so they cannot drift apart.

**Controls appear or disappear.**
A member sees no *New project*, no *New deliverable*, no edit or delete icons.
A manager sees them on their own projects and not on anyone else's.

**Administrators get an explanation, not a mystery.**
Rather than a silently missing button, Projects, Deliverables and Budget carry a
line: *"Administrators oversee the system. Creating projects, proposing budgets
and assigning work are project manager responsibilities."*

**The dialog itself changes shape.**
A member opening their own deliverable gets *Update my progress* — status and
completion only, with the name, assignee and dates read-only. A manager on the
same item gets the full form.

**Navigation is scoped.**
*Activity log* only appears for administrators and managers. Projects opens on
*My projects* for a manager and *All projects* for an administrator.

**The dashboard changes entirely.**
Administrator sees an organisation-wide view; manager sees their portfolio;
member sees "My work" — their assignments and what is due.

**A profile reflects the role.**
An administrator has no weekly capacity or project allocation, because nobody
assigns work to the platform administrator. They see a platform overview
instead.

---

## Where it is actually enforced

The interface is a convenience. Every request is authorised independently in
the service, using the identity in the signed token rather than anything the
client sent.

```python
# backend/*/function.py
user = require_auth(event)                       # verify the token
deny_admin_business_action(user, 'create projects')
require_project_owner(user, project, 'edit this project')
```

Ownership is taken from the token's claims, so a client cannot claim to be
someone else by putting a different name in the request body.

Proof, without the interface:

```bash
# No token at all
curl -i -X DELETE $API/projects/<id>
# 401 Authentication required

# A manager on someone else's project
curl -i -X PUT $API/projects/<other-managers-id> \
  -H "Authorization: Bearer $MANAGER_TOKEN" -d '{"status":"active"}'
# 403 You can only manage projects you own

# An administrator creating a project
curl -i -X POST $API/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"name":"x"}'
# 403 Administrators oversee the system and cannot create projects.
#     This is a project manager responsibility.

# An administrator retiring a project
curl -i -X DELETE $API/projects/<id> -H "Authorization: Bearer $ADMIN_TOKEN"
# 403 — the project's lifecycle belongs to the manager who owns it
```

There are integration tests for each of these.

---

## Showing it in the presentation

**Forty seconds, two sign-ins.** Do not narrate the whole matrix — show two
screens and state the principle.

**Already signed in as Michael Rao (manager).** On Projects:

> "Michael manages two of these six projects. He can edit and retire his own —
> and on the others there's no edit control at all."

*Point at a row he owns, then one he doesn't.*

**Sign out, sign in as Alice Fernandes (admin).** Same page:

> "Alice is the administrator. She can see everything, but there's no
> *New project* button — and the app says why."

*Point at the banner.*

> "That's deliberate. An admin who can do everything makes the role meaningless.
> This is a manager's tool — the whole project lifecycle belongs to them,
> including retiring one. Admins own identity and oversight: accounts, roles,
> the audit trail, the support queue. Privilege and responsibility are separate
> things.
>
> And nothing is ever permanently deleted — retiring a project keeps the record
> with the manager's name against it."

**If you have another ten seconds**, sign in as Sana Kapoor:

> "And a member gets a restricted dialog on her own deliverable — status and
> completion only. She can't reassign it or move the deadline."

**If they ask whether it is real:**

> "It's enforced in the API, not the interface. The identity comes from the
> signed token, so it can't be spoofed, and there are integration tests that
> make the calls the UI would never send."

---

## Questions you should expect

**"What if someone edits the JavaScript to show the button?"**
> The button reappearing changes nothing — the request still goes to the API,
> which authorises it independently. That is exactly what the integration tests
> check.

**"Why can a manager hire but not delete an account?"**
> Hiring adds capacity to a team, which is a delivery decision. Removing
> someone's access is account administration, and it affects work across other
> projects too.

**"Could a manager promote themselves to admin?"**
> No. Role changes are administrator-only, checked server-side, and the role is
> read from the signed token rather than the request. That is the privilege
> escalation the brief asks you to prevent.

**"So what is the administrator actually for?"**
> Identity and oversight. They onboard accounts, set roles, review the full
> activity log, and run the support queue. Without that the first manager could
> not exist, and nobody could revoke access when someone leaves.

**"What happens when a manager leaves?"**
> Their projects keep their name as owner and nobody else can edit them until an
> administrator reassigns. That reassignment flow does not exist yet — it is a
> genuine gap, and the honest answer is that an administrator would update the
> manager field directly.
