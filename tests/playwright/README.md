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
- Nothing may derive a port, domain or database name before the global setup reserved the block, so
  the reservation happens before the frontend build and the migrations start.

## Databases

Each worker gets its own database, named `stamhoofd-playwright[-<instance>]-<slot>` after its slot,
with the instance name of the worktree in it for every worktree except the primary one. So two runs
never share a database, not even when they connect to the same MySQL server, and a checkout on
another branch migrates its own databases. The prefix is passed in by `stam test e2e`
(`PLAYWRIGHT_DB_PREFIX`), the databases are created and migrated in the global setup, and they are
kept between runs so the migrations don't have to run again.

By default `stam test e2e` starts a MySQL container for the run. With `--local-db` (or
`STAMHOOFD_E2E_MYSQL_PORT`) it connects to a MySQL that is already running on `127.0.0.1` instead;
see the CLI README. Only the connection changes: the databases and their names stay the same.

## Test file naming

Seperate test files for each userMode exist.
Tests for userMode `platform` end with `-platform`, tests for userMode `organization` end with `-organization`.
Each worker authenticates a user. This way every test file can share the same user without having to authenticate again. If tests for different userModes would be mixed the authentication would have to be done again every time the userMode changes.

## Error resolving

Here are some solutions for errors that may appear.

### Database error

Try dropping the database for the worker.
