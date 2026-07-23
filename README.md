# ACME Project Hub

A project delivery platform for ACME Inc. Managers run projects, team members
report progress, and everyone can see which work is slipping and why.

**Live:** https://d2sdkxdli7jnn4.cloudfront.net
**Demo accounts:** see `ACME-Demo-Credentials.docx`

---

## The problem this solves

ACME runs projects across several departments with no shared view of them.
Managers cannot tell which deliverables are blocked, who is over-allocated, or
whether spend is tracking to plan — so deadlines slip before anyone notices.

The application answers seven questions directly:

| Question | Where it is answered |
|---|---|
| What is the status of each project? | Dashboard, Projects |
| Which projects risk missing their deadline? | Automatic at-risk detection, surfaced on the dashboard |
| How are resources allocated? | Resources, with utilisation against capacity |
| What are the deliverables and how far along are they? | Deliverables, grouped by project |
| Who is over-allocated? | Resources; the assignment dialog refuses to over-commit anyone |
| What is the dependency chain between deliverables? | Delivery Sequence on each project |
| How much budget is consumed versus planned? | Budget, with variance per project |

---

## Running it

```bash
git clone <this repo> && cd coding-workshop-participant

# Backend dependencies, per service, for the Lambda runtime
for svc in projects deliverables budget people support; do
  python3.13 -m pip install -r backend/$svc/requirements.txt \
    --target=backend/$svc --no-compile
done

cd frontend && npm install && cd ..

./bin/start-dev.sh          # http://localhost:3000
```

Then seed the demo data:

```bash
curl -X POST http://localhost:3001/api/people/seed
```

The seed is idempotent — running it twice creates nothing new.

**Deploying:**

```bash
./bin/deploy-backend.sh     # Lambda, Aurora, API routes
./bin/deploy-frontend.sh    # S3 + CloudFront
```

**Tests:** see [TESTING.md](./TESTING.md). In short:

```bash
python3.13 -m pytest backend/tests -v --ignore=backend/tests/integration   # 41 unit
cd frontend && npm test                                                    # 49 unit
python3.13 -m pytest backend/tests/integration -v                          # 41 integration (app must be running)
```

---

## Architecture

```
Browser ──► CloudFront ──┬──► S3            static React build
                         └──► Lambda ──► Aurora PostgreSQL
```

Five Lambda functions, one per domain, each self-contained so it can be
deployed and reasoned about independently:

```
backend/
  projects/       projects and ownership
  deliverables/   work items, dependencies, progress timeline
  budget/         proposed and actual spend
  people/         identity, authentication, hiring
  support/        helpdesk queue
```

Each service carries its own copy of `auth.py` and `audit.py`. Duplication is
deliberate: a Lambda is packaged as an isolated bundle, and a shared-layer
abstraction would have added deployment machinery for very little gain at this
size.

```
frontend/src/
  pages/          one file per screen
  components/     reusable pieces (PageHeader, MetricCard, ProjectGroupCard,
                  StatusChip, ProgressTimeline, DependencyChain)
  utils/          business logic, framework-free and unit tested
                  permissions.js · risk.js · dependencies.js
  services/       API clients; api.js attaches the JWT and handles 401
  theme/          design tokens and the global MUI theme
```

The logic that decides anything lives in `utils/` — deliberately free of React
so it can be tested directly, and so the same rules can be read next to the
server-side versions they mirror.

---

## The role model

The system has three roles, and the split is the most important design decision
in the application.

**Administrator — runs the platform, not the projects.**
Sees everything, manages accounts, performs compliance deletions, owns the
support queue and the audit trail. Deliberately *cannot* create projects,
propose budgets or assign work; attempting to do so returns a 403 explaining
that this is a project manager's responsibility.

**Manager — the primary actor.**
Owns projects end to end: creates them, proposes their budget, manages
deliverables, hires into the team, and assigns people from available capacity.
Scoped to what they own — a manager cannot touch another manager's project.

**Member — does the work.**
Reads the portfolio, and reports status and completion on deliverables assigned
to them. Nothing else.

This matters because the alternative — an administrator who can do everything —
makes the role meaningless and puts business decisions in the hands of whoever
happens to hold the highest privilege. Here, privilege and responsibility are
separate axes.

---

## Design decisions

**Authorisation is enforced in the API, not the interface.**
The frontend hides controls a user cannot use, but every request is
independently authorised server-side. A hidden button proves nothing; the
integration suite asserts this by making the calls the UI would never send.
Project ownership is taken from the token's claims rather than the request
body, so it cannot be spoofed.

**Passwords are hashed with bcrypt; sessions are JWTs.**
Cost factor 12, unique salt per user. Hashing is one-way — the original
password cannot be recovered from the stored hash, and `password_hash` is never
returned by any endpoint. Login failures return an identical message whether
the email or the password was wrong, so responses cannot be used to discover
which accounts exist. Tokens expire after eight hours.

**Derived values are calculated, never typed.**
A project's completion is the average of its deliverables. Budget consumed is
the sum of its entries. Typed numbers go stale the moment work moves — an
early version allowed a project to read 20% complete while two of its three
deliverables were finished.

**A status can never contradict its percentage.**
Marking a deliverable complete sets it to 100%; dropping a completed item below
100% reopens it. This encodes a real bug: the app once displayed "Completed" on
a deliverable sitting at 70%.

**Dependencies are finish-to-start.**
A deliverable cannot record progress until the work it depends on is finished.
Blocking is *derived* from the chain rather than stored as a flag, so it stays
correct without anyone maintaining it, and the system explains what is holding
each item up. Circular dependencies are impossible to create.

**Progress requires a note.**
A percentage on its own records nothing useful a week later. Every movement
carries a short explanation, which accumulates into a timeline on the
deliverable; managers reply on the same thread.

**Financial records are never erased.**
Deleting a budget entry sets `deleted_at` and `deleted_by` rather than removing
the row. The entry leaves the active view but stays attributable, and appears
under "Removed budget entries" in the activity log.

---

## Trade-offs and assumptions

**Assumptions made:**
- One manager owns a project. Co-ownership is not modelled.
- A person's capacity is a single weekly figure; part-time patterns and leave
  are out of scope.
- Budget is proposed by the manager and recorded directly. There is no separate
  approval step, because the brief describes tracking rather than procurement.
- Currency is displayed as a single unit; no multi-currency handling.

**Known simplifications:**
- **No refresh tokens.** An expired session means signing in again rather than
  renewing silently. Production would pair a short-lived access token with a
  refresh token.
- **The JWT secret falls back to a development default** when `JWT_SECRET` is
  unset. In production this belongs in AWS Secrets Manager; the code marks
  where.
- **Team membership is stored as text on the person record** rather than a join
  table. It was the smaller change to an existing schema; a proper
  `project_members` table is the correct shape and the first thing I would
  migrate.
- **Page components still carry inline styling.** Design tokens and the theme
  are centralised, but the larger screens would read better with their layout
  extracted into co-located style modules. The pattern is in place in
  `pages/styles/projectDetail.styles.js`.

**Deliberately not built:**
- End-to-end browser tests. The clearest remaining gap in the test strategy —
  see TESTING.md.
- Notifications and email. Nothing leaves the application.
- File attachments on deliverables or tickets.

---

## Notes from building it

Two problems took real debugging and shaped the result:

**The dev proxy was silently dropping authentication headers.** After adding
JWT verification, every request returned 401 with a token that was demonstrably
valid. The cause was a header whitelist in `bin/proxy-server.js` — the
workshop's scaffolding predates authentication, so it forwarded only four
headers and discarded `Authorization`. Tracing it meant checking the client,
the service, and finally the hop between them. The service now also accepts
`X-Auth-Token`, because Lambda Function URLs reserve `Authorization` for IAM
signature verification and can consume it before the function sees it.

**A `cp39-abi3` wheel and two Pythons.** Deployment kept failing with
`No module named psycopg` despite the package being installed. The VDI's default
`pip` targets Python 3.14 while the Lambda runtime is 3.13, so the installed
binary was invisible to the runtime. Fixed by pinning the install to
`python3.13 -m pip`.

Both are the same lesson: when the client is correct and the server is correct,
the fault is in the layer between them.

---

## Repository

```
backend/          five Lambda services + tests
frontend/         React application
infra/            Terraform for Lambda, Aurora, S3, CloudFront
bin/              dev and deployment scripts
docs/             workshop documentation
TESTING.md        test strategy, coverage and known gaps
ACME-Demo-Credentials.docx   demo accounts and seeded data
```
