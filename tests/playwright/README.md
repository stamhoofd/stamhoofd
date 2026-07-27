# Stamhoofd Playwright tests

Playwright tests for Stamhoofd.

## Todo
Set a fixed time. The tests should be predictable. Now the current time in tests will change depending on the date the test is run.

## Authentication

The `test-fixtures` folder contains several fixtures:

- `base.ts`: a base fixture without authentication that is extended by the other fixtures
- `platform.ts`: a fixture that authenticates a platform user

By using the platform fixture for example you can automatically authenticate a basic platform user.
In the test file you can edit and save the user, for example if you want to add permissions.
The user for the worker can be acquired by calling `WorkderData.user`.
`WorkerData.configureUser` contains helper methods to configure the user.
The user can be reset by calling `WorkerData.resetUser`, or `WorkderData.resetDatabase` if other data should be reset also.

## Ports and domains (running several e2e runs at once)

Every worker gets a *slot*: its API/dashboard/registration/webshop ports (`6000`, `6100`, `6200`,
`6300` + slot) and its domains (`playwright-<service>-<slot>.stamhoofd`) are all derived from it.

A run does not start at slot 0 but reserves a block of consecutive slots, one per worker, in the
global setup: `CaddyService.reserveRouteManifest` walks through the blocks and takes the first one
that no other route manifest reserves *and* whose ports can all be bound. The block it settled on
is written to a route manifest (`playwright-<instance>-<pid>`) that the CLI merges into the shared
Caddy config, and passed to the workers through `PLAYWRIGHT_SLOT_OFFSET`. So a run started from
another worktree, or while `stam dev` is running, gets its own ports, domains and SSO server
instead of fighting over the same ones. The manifest is removed again in the global teardown, and
manifests of a run that crashed are ignored as soon as its process is gone.

Consequences worth knowing:

- The number of workers has to be known before the tests start. Set `PLAYWRIGHT_WORKER_COUNT`
  (`stam test e2e --workers N` does this) instead of passing `--workers` to Playwright directly.
- At most `slotPoolSize` (30) workers can run at the same time across all runs on one machine.
- The databases are still named per worker index, not per slot, and the e2e MySQL container is per
  worktree: two runs from the *same* worktree still collide. Run them from different worktrees.

## Test file naming

Seperate test files for each userMode exist.
Tests for userMode `platform` end with `-platform`, tests for userMode `organization` end with `-organization`.
Each worker authenticates a user. This way every test file can share the same user without having to authenticate again. If tests for different userModes would be mixed the authentication would have to be done again every time the userMode changes.

## Error resolving

Here are some solutions for errors that may appear.

### Database error

Try dropping the database for the worker.
