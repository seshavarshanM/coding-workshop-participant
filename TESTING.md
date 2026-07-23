# Testing

## Running the tests

```bash
# Unit — 41 backend tests, no infrastructure needed
python3.13 -m pytest backend/tests -v --ignore=backend/tests/integration

# Unit — 49 frontend tests
cd frontend && npm test

# Integration — 41 tests against the running API
./bin/start-dev.sh          # in another terminal
python3.13 -m pytest backend/tests/integration -v
```

**131 tests in total.** The unit suites run in about a second and need no
database, no server and no network. The integration suite talks to the live API
over HTTP and skips itself cleanly when the app is not running, so a missing
environment never reads as a failure.

## What is covered, and why

The suite targets **decisions and calculations** — the code where being wrong
causes real damage. Rendering is left to the component libraries that own it.

### Authentication (`backend/tests/test_auth.py` — 15 tests)

Every test here describes an attack that would otherwise succeed silently:

| Test | What it prevents |
|---|---|
| Request with no token is rejected | Anonymous access to every endpoint |
| Token signed with a different secret is rejected | Forging an admin token |
| Tampered payload is rejected | Editing your own role inside a token |
| Expired token is rejected | Sessions that never end |
| Identity is read from the token, not the request | Claiming to be another user in the request body |

It also covers transport realities: header casing differs between API Gateway,
Lambda Function URLs and the local dev proxy, and Function URLs can consume the
`Authorization` header entirely — so `X-Auth-Token` is accepted as a fallback.
That behaviour exists because of a real failure, and the tests keep it fixed.

### Authorization (`backend/tests/test_authorization.py` — 15 tests)

The role model asserted end to end:

- **Administrators are not business actors.** They cannot create projects or
  propose budgets; they keep compliance deletion, account management and the
  audit trail.
- **Managers are scoped to what they own.** A manager acting on another
  manager's project is refused.
- **Members do the work.** They are refused every structural action.

### Business rules (`backend/tests/test_business_rules.py` — 11 tests)

- Status and completion can never contradict each other — 100% forces
  *Completed*, and a *Completed* item dropped below 100% reopens. This encodes
  a bug found during development, where a deliverable read "Completed" at 70%.
- Project completion is the average of its deliverables, never a typed number.

### Permissions in the interface (`frontend/src/__tests__/permissions.test.js` — 18 tests)

The frontend rules mirror the backend rules. These tests exist so the interface
never offers a button the API will reject — the two are asserted against the
same role model.

### Dependencies (`frontend/src/__tests__/dependencies.test.js` — 18 tests)

- Finish-to-start: work cannot record progress until its predecessor is done
- Blocking is derived, so it stays true without anyone maintaining a flag
- Cycles are impossible: a deliverable cannot depend on itself or on an ancestor
- Chain building never loses a deliverable, and separates genuinely independent
  work from parallel branches sharing a predecessor

### Risk detection (`frontend/src/__tests__/risk.test.js` — 13 tests)

Boundary behaviour of the at-risk rule: overdue and unfinished, or within
fourteen days at under seventy percent. Completed projects are never flagged,
and the reason given is checked, not just the verdict.

## Integration tests (`backend/tests/integration` — 41 tests)

These make real HTTP calls to the running service. Nothing is mocked: the
request is authorised, the database is written, and the response is checked
against the contract the frontend depends on.

They matter because a hidden button proves nothing. The interface disables
controls to keep people out of invalid states, but the rule only holds if the
API refuses the request regardless — and these tests bypass the interface
entirely to prove it does.

**Authentication** (`test_authentication_api.py`) — attacks executed for real
against the deployed service:

| Test | What it proves |
|---|---|
| `DELETE /projects/{id}` with no token → 401 | The request that once destroyed data with no credentials is now refused |
| Forged token → 401 | A hand-written admin token is rejected by signature verification |
| Wrong password and unknown email return identical responses | The API cannot be used to discover which accounts exist |
| No endpoint response contains `password_hash` | Hashes never leave the database |

**Authorization** (`test_authorization_api.py`) — the role model asserted at the
endpoint: an administrator is refused when creating projects or proposing
budget; a manager is refused on another manager's project and cannot delete;
a member is refused every structural action.

**Business rules** (`test_business_rules_api.py`) — finish-to-start is enforced
server-side, the refusal names the blocking deliverable, and a progress move
without a note is rejected.

**CRUD contracts** (`test_crud_api.py`) — full lifecycles with correct status
codes (201 on create, 200 on update, 404 after removal), verifying that changes
persist rather than merely echo. Also covers behaviour that only exists at the
API level: project ownership assigned from the token rather than the request
body, budget entries soft-deleted so they stay attributable, the support queue,
and the progress timeline.

Every test cleans up what it creates, so the suite can run repeatedly against
the same database.

## What is deliberately not covered

Being explicit about the gaps is more useful than an inflated number:

- **Component rendering.** Whether Material UI draws a button is Material UI's
  responsibility.
- **End-to-end browser journeys.** A Playwright or Cypress pass over
  sign-in → create project → assign work → print report would catch wiring
  mistakes that neither unit nor integration tests can see — a button bound to
  the wrong handler still passes both. This is the clearest remaining gap and
  the next thing worth building; it was scoped out because the setup cost is
  large relative to the workshop timebox.
- **Concurrency.** Two managers editing the same project at once is untested.
- **Load and performance.** No throughput or latency testing was attempted.

## Manual verification

Alongside the automated suite, each API was exercised directly, including the
cases that matter most:

```bash
# Without a token — must be 401
curl -i -X DELETE http://localhost:3001/api/projects/<id>

# With a forged token — must be 401
curl -i http://localhost:3001/api/projects -H "Authorization: Bearer fake.token.here"

# Completing work whose dependency is unfinished — must be 400
curl -i -X PUT http://localhost:3001/api/deliverables/<id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```
