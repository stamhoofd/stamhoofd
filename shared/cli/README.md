# Stamhoofd CLI

`stam` is the development CLI for this repository. It manages local setup, shared services, app processes, development configuration, database helpers, SSO helpers, tests, and cleanup.

## Quick Start

```bash
yarn install
yarn stam setup
yarn stam dev all
```

Run `yarn stam setup shell` to install the CLI alias `stam` in your .zshrc or .bashrc (that removes the need to type `yarn` and the need to always run commands in the project root).

Open the dashboard URL printed by the CLI, or run `yarn stam status` to see active services, instances, URLs, and credentials.

Run `yarn stam --help` or `yarn stam <topic> --help` for command help.

## For CLI Users

### Commands

| Area        | Command                              | Purpose                                                                  |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Build       | `yarn stam build`                    | Build shared packages and all app packages for the selected environment. |
| Setup       | `yarn stam setup`                    | Check the machine and offer recommended setup fixes.                     |
| Setup       | `yarn stam setup node`               | Install the Node.js version from `.nvmrc` using fnm or nvm.              |
| Setup       | `yarn stam setup dns`                | Configure local `.stamhoofd` DNS.                                        |
| Setup       | `yarn stam setup cert`               | Trust the local Caddy HTTPS authority.                                   |
| Development | `yarn stam dev all`                  | Start shared services and the full app stack.                            |
| Development | `yarn stam dev backend`              | Start backend apps for the current instance.                             |
| Development | `yarn stam dev frontend`             | Start frontend apps only.                                                |
| Development | `yarn stam dev instance`             | Start this workspace instance using shared services.                     |
| Services    | `yarn stam services up`              | Start shared Docker services.                                            |
| Services    | `yarn stam services status`          | Show shared service status.                                              |
| Services    | `yarn stam services logs`            | Tail shared service logs.                                                |
| Services    | `yarn stam services restart`         | Restart shared services with interactive progress output.                |
| Services    | `yarn stam services down`            | Stop shared services.                                                    |
| Services    | `yarn stam services stop`            | Alias for `yarn stam services down`.                                     |
| Status      | `yarn stam status`                   | Show shared services, active instances, URLs, and credentials.           |
| Config      | `yarn stam config explain`           | Explain resolved instance config.                                        |
| Config      | `yarn stam config print`             | Print resolved domains and backend environment values as JSON.           |
| Database    | `yarn stam db shell`                 | Open a MySQL shell for the current local database.                       |
| Database    | `yarn stam db migrate`               | Build shared packages and run migrations.                                |
| SSO         | `yarn stam sso config`               | Print local SSO client, user, and issuer settings.                       |
| SSO         | `yarn stam sso start <redirect-uri>` | Start Keycloak and import the local realm.                               |
| SSO         | `yarn stam sso logs`                 | Tail Keycloak logs.                                                      |
| SSO         | `yarn stam sso stop`                 | Stop the local Keycloak container.                                       |
| Metabase    | `yarn stam metabase start`           | Start Metabase and register the environment's statistics database.       |
| Metabase    | `yarn stam metabase config`          | Print the Metabase URL, login, and data source settings.                 |
| Metabase    | `yarn stam metabase logs`            | Tail Metabase logs.                                                      |
| Metabase    | `yarn stam metabase stop`            | Stop the local Metabase container.                                       |
| Tests       | `yarn stam test unit`                | Run unit tests with isolated MySQL.                                      |
| Tests       | `yarn stam test e2e`                 | Run Playwright tests.                                                    |
| Tests       | `yarn stam test all --ci`            | Run unit and E2E tests in CI mode.                                       |
| Checks      | `yarn stam check lint`               | Run ESLint across the monorepo.                                          |
| Checks      | `yarn stam check typecheck`          | Run TypeScript checks across the monorepo.                               |
| Checks      | `yarn stam check all`                | Run build, lint, typecheck, unit tests, and E2E tests.                   |
| Cleanup     | `yarn stam clean build`              | Remove build artifacts.                                                  |
| Cleanup     | `yarn stam clean db`                 | Drop the selected local MySQL database after confirmation.               |
| Cleanup     | `yarn stam clean sso`                | Stop the local SSO server.                                               |
| Cleanup     | `yarn stam clean metabase`           | Stop Metabase and drop its application database after confirmation.      |
| Cleanup     | `yarn stam clean services`           | Stop shared services.                                                    |
| Cleanup     | `yarn stam clean all`                | Clean build artifacts and stop shared services.                          |

### Development Configuration

`shared/cli` owns local development configuration. Backend and frontend development builds load domains, ports, database settings, storage settings, and app environment values from `@stamhoofd/cli`.

The main config contract lives in `src/config/development-config.ts`. Keep local-development settings there first, then consume the resolved config from commands, workflows, Caddy, SSO, Stripe, status output, or app bootstrapping.

Inspect the current config with:

```bash
yarn stam config explain
yarn stam config print
yarn stam config print --env keeo
```

### Instances And Ports

The CLI infers an instance from the workspace, selected environment, and optional overrides.

Useful flags:

- `--env <name>` selects the development environment. The default is `stamhoofd`.
- `--name <name>` overrides the inferred instance name.
- `--verbose` prints extra diagnostics and commands.

Useful environment variables:

- `STAMHOOFD_WORKSPACE_NAME` overrides the workspace name.
- `STAMHOOFD_PRIMARY_INSTANCE=1` forces primary-instance behavior.
- `STAMHOOFD_INSTANCE_PREFIX` overrides the domain prefix.
- `STAMHOOFD_PORT_OFFSET` overrides the deterministic port offset.
- `STAMHOOFD_DOMAIN` overrides the shared local domain, defaulting to `stamhoofd`.
- `MYSQL_PORT` overrides the local MySQL host port, defaulting to `3307`.
- `STAMHOOFD_E2E_MYSQL_PORT` runs the e2e tests against a MySQL that is already running on `127.0.0.1` instead of starting a container for them (see Tests).
- `STAMHOOFD_E2E_MYSQL_USER` and `STAMHOOFD_E2E_MYSQL_PASSWORD` override the credentials of that MySQL, defaulting to `root` / `root`.
- `STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_SIZE` tunes the MySQL container InnoDB buffer pool size (e.g. `512M`, `1G`), defaulting to `4G`.
- `STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_INSTANCES` tunes the MySQL container InnoDB buffer pool instances defaulting to `4`.
- `STAMHOOFD_MYSQL_SORT_BUFFER_SIZE` tunes the MySQL container sort buffer size (e.g. `8M`), defaulting to `2M`.
- `METABASE_PORT` overrides the local Metabase host port, defaulting to `3030`.
- `METABASE_ADMIN_EMAIL` and `METABASE_ADMIN_PASSWORD` override the Metabase admin account the CLI signs in with, for an instance that was set up by hand (see Local Metabase).
- `PUBLIC_IP`: Publish DNS records to your computers public IP address, and make Caddy listen on 0.0.0.0 instead of localhost. Useful for testing on local devices. E.g. `PUBLIC_IP=192.168.1.7 stam services restart` `PUBLIC_IP=192.168.1.7 stam dev all`

The primary `stamhoofd` instance uses base ports. With Git, the primary instance is the first worktree in `git worktree list --porcelain`. With jj, it is the first workspace in `jj workspace list`. Other worktrees and workspaces get deterministic offsets based on the workspace name so multiple workspaces can run on the same machine without changing databases when branches change.

When needing a heavy duty MySQL instance to test migrations, you can restart MySQL using:

```
STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_INSTANCES=10 \
STAMHOOFD_MYSQL_SORT_BUFFER_SIZE=64M \
STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_SIZE=16G \
stam services restart
```

### Shared Services

Shared services run as Docker containers:

- MySQL: `stamhoofd-mysql`
- MailDev: `stamhoofd-maildev`
- RustFS: `stamhoofd-rustfs`
- CoreDNS: `stamhoofd-coredns`
- Caddy: `stamhoofd-caddy`

Metabase (`stamhoofd-metabase`) is not part of that baseline: it is a JVM service that costs a lot of
memory and start-up time, so it runs on demand through `stam metabase start` (see Local Metabase).

The setup is intentionally different where Docker behaves differently:

- Linux runs Caddy on unprivileged ports `8080/8443` and uses `sudo iptables` redirects from `80/443`.
- Linux configures split DNS through `systemd-resolved`, pointing `.stamhoofd` to CoreDNS on `127.0.0.1:1053`.
- macOS uses Docker Desktop bridge networking for Caddy, publishes `80/443` directly, and proxies back to host app ports through `host.docker.internal`.
- macOS configures `/etc/resolver/stamhoofd` with `nameserver 127.0.0.1`, so only the `stamhoofd` resolver domain and its subdomains use local CoreDNS on port `53`.
- MySQL listens on host port `3307` by default and still uses container port `3306`.

Start and inspect them with:

```bash
yarn stam services up
yarn stam services status
yarn stam services logs
```

Stop them with:

```bash
yarn stam services down
```

### Local SSO

Use `yarn stam sso config` to print the issuer, client credentials, test user, and example command.

Start Keycloak with the redirect URI copied from the app:

```bash
yarn stam sso start "https://<organization-id>.api.stamhoofd/openid/callback"
```

The command imports a local realm with the printed client and test user.

`yarn stam test e2e` starts a second Keycloak from the same `SsoService`, on its own container, port (6400) and host (`playwright-sso.stamhoofd`), with a realm that allows the `/openid/callback` of every Playwright worker. It is started and stopped by the Playwright global setup, so it never restarts the server you started for manual testing. Like the other e2e services it binds a fixed port, so only one e2e run can be up at a time.

### Local Metabase

Metabase runs locally as an on-demand container, so it only costs memory while you actually use it:

```bash
yarn stam metabase start
```

The command starts the shared services if needed, reloads Caddy, waits until Metabase answers
`/api/health` (the first start migrates its application database and takes a few minutes), and then
configures it. No wizard, no manual data source.

#### Platform statistics per environment

Each environment reports on its own **platform statistics database**, so a dashboard built against
Keeo never reads Ravot numbers. `stam metabase start` creates that database if needed and registers
it as a data source named after the environment:

| Command                          | Data source                     | MySQL database                    |
| -------------------------------- | ------------------------------- | --------------------------------- |
| `stam metabase start`            | `Platform statistics (stamhoofd)` | `platform-statistics-development` |
| `stam metabase start --env keeo` | `Platform statistics (keeo)`    | `platform-statistics-keeo`        |
| `stam metabase start --env ravot`| `Platform statistics (ravot)`   | `platform-statistics-ravot`       |
| `stam metabase start --env jambo`| `Platform statistics (jambo)`   | `platform-statistics-jamboree`    |

The names come from `databases.platformStatistics` in `src/config/development-config.ts`, which
follows the same rules as the main development database: environments keep their historical label
(`stamhoofd` → `development`, `jambo` → `jamboree`), and a secondary instance suffixes its own name so
worktrees never share data.

The **tables** in that database are created by the backend migrations, not by this command:

```bash
yarn stam db migrate --env keeo    # creates the statistics schema
yarn stam metabase start --env keeo
```

Run in the other order and Metabase registers a database that is still empty. It caches the schema it
found and only refreshes on its own schedule, so the data source keeps showing no tables. Running
`stam metabase start` again fixes that: it asks Metabase to re-read the schema every time, and warns
when the database has no tables yet.

Every run also tidies up the instance: it drops Metabase's demo database (new containers never create
one) and hides the `migrations` table of the data source it configured, which is schema history
rather than something to report on. The tables listed in `metabaseHiddenTables` are the ones hidden.

One Metabase serves every environment. Running the command for a second environment adds that data
source next to the existing ones, and an already registered data source is left untouched, so edits
made in the UI survive. Print the settings of an environment with `stam metabase config --env keeo`.

#### Login

The CLI completes the setup wizard itself and owns the admin account, so it can keep configuring the
instance later. `stam metabase config` prints the credentials.

If you set Metabase up by hand with your own account, the CLI cannot sign in. Either point it at your
account with `METABASE_ADMIN_EMAIL` and `METABASE_ADMIN_PASSWORD`, or start over with
`stam clean metabase`.

#### Storage

Metabase keeps its own questions, dashboards and users in an **application database**, which gets its
own `stamhoofd-metabase` database on the shared MySQL container rather than the embedded H2 database
Metabase defaults to. H2 is unsupported for anything but a throwaway trial and cannot be migrated in
place later, so local and server setups both use a real database.

Reset Metabase (drops all local questions and dashboards, keeps the statistics data) with:

```bash
yarn stam clean metabase
```

`METABASE_PORT` overrides the host port, which defaults to `3030`.

### Tests

`yarn stam test` runs `build:shared` first and only starts a MySQL container when a selected package needs one. That container runs off a data volume that persists between runs (so the data dir + migrations are reused, mapped `DB_PORT`), and it is shut down after the run. Both the container and volume are namespaced per worktree so runs don't collide:

```bash
yarn stam test unit                                 # every unit package (excludes Playwright)
yarn stam test api                                  # one package (api, models, sql, structures, renderer, redirecter, queues, utility, sgv, object-differ, eslint)
yarn stam test unit SomeFile                         # filter by filename across all packages
yarn stam test structures bundle-discounts           # package + filename filter
yarn stam test structures -t 'partial test name'     # package + test-name filter (passed to vitest -t)
yarn stam test api --skip-build                      # skip the automatic build:shared step
yarn stam test api --clear                           # reset the test database (drop its volume) before running
```

Run Playwright tests with:

```bash
yarn stam test e2e                                   # full build + suite
yarn stam test e2e --ui                              # run with interactive UI to view and pause tests
yarn stam test e2e --grep @tag                       # only tests matching a name/tag (playwright --grep)
yarn stam test e2e --grep @tag --skip-build          # skip build:shared + API/frontend rebuild (only test files changed)
```

Like the unit runs, the e2e command keeps its data volume between runs (so migrated worker databases are reused) and shuts the container down afterward. Reset that persistent e2e database with:

```bash
yarn stam test e2e --clear
```

Use `--workers <number>` to override Playwright's default worker count for a run.
Use `--extra` to include tests tagged `@extra`.

#### Running e2e tests without a MySQL container

A MySQL that is already running on this machine can serve the e2e tests instead, which skips both the e2e MySQL container and the shared `stamhoofd-mysql` container (the e2e tests never use the development database):

```bash
yarn stam test e2e --local-db                          # MySQL on 127.0.0.1:3306
STAMHOOFD_E2E_MYSQL_PORT=3307 yarn stam test e2e       # the shared stamhoofd-mysql container
STAMHOOFD_E2E_MYSQL_PORT=3306 STAMHOOFD_E2E_MYSQL_USER=tests STAMHOOFD_E2E_MYSQL_PASSWORD=secret yarn stam test e2e
```

Set `STAMHOOFD_E2E_MYSQL_PORT` in your shell profile to make this the default, and pass `--no-local-db` for a single run that should use a container after all. The server has to be reachable already: the CLI never starts or stops it, and `--clear` drops the worker databases of the run instead of a data volume.

The worker databases are named `stamhoofd-playwright[-<instance>]-<slot>`, after the slot a worker runs on. Since a run reserves a block of slots no other run on this machine uses, several runs can share one MySQL server without sharing a database. Unit tests still always use a container: they all use the same `stamhoofd-tests` database.

Run the full validation flow with:

```bash
yarn stam check all
```

## For CLI Maintainers

The sections below are for contributors working on `shared/cli` itself rather than only using the CLI.

### Architecture Overview

`shared/cli` is organized around a small set of responsibilities:

- `src/commands/`: oclif command entrypoints that parse flags and dispatch work.
- `src/workflows/`: multi-step flows such as machine setup or starting a full development session.
- `src/services/`: shared Docker service abstractions, service definitions, and service orchestration.
- `src/config/`: development configuration and generated infrastructure config such as Caddy routing.
- `src/context/`: workspace, instance, and port resolution.
- `src/runtime/`: process execution, output rendering, manifests, help rendering, and external CLI helpers.

The intended flow is:

1. Commands parse user input.
2. Commands create a `CliContext`.
3. Commands call workflows, runtime helpers, or services.
4. Workflows orchestrate long-running behavior, service startup, manifests, and output.
5. Services encapsulate Docker-specific behavior.

Try to keep that direction intact. Commands should stay thin, workflows should own coordination, and runtime utilities should stay generic enough to be reused from multiple commands.

### Runtime Concepts

Some runtime concepts show up across many commands and are worth understanding before changing behavior.

#### Instance Inference

The CLI computes a `CliContext` from:

- the repository root
- the selected environment
- the workspace name
- optional overrides such as `--name` or environment variables

That context decides the instance name, domain prefix, whether the instance is considered primary, and the port offset used by local apps.

#### Port Allocation

Base ports come from `src/context/ports.ts`.

For secondary instances, `src/context/instance.ts` and `src/context/port-allocation.ts` assign deterministic offsets so multiple clones of the repository can run at once. If a computed range is occupied, the CLI steps to the next bucket until it finds a free range or fails with a clear error.

#### Manifests

The CLI writes JSON manifests under `.development/cli/generated` to describe what is currently running.

- instance manifests let `stam status` and Caddy discover active local instances
- the shared services manifest records that shared infrastructure was started

When changing startup or shutdown behavior, keep manifest creation and cleanup in sync or the CLI will show stale instances or stale routes.

#### Output Flow

Long-running commands do not write directly to `console.log` unless they intentionally bypass the CLI output system. Instead they use runtime helpers so status lines, live output, tables, and command logging can coexist without corrupting terminal output.

When changing interactive output, check `src/runtime/live-output.ts`, `src/runtime/output-target.ts`, and `src/runtime/ux.ts` together.

### Service Model

Shared infrastructure is modeled through `ServiceDefinition` in `src/services/service.ts`.

The common patterns are:

- `DockerService`: base class for services that start through `docker run`
- `SharedDockerService`: convenience base for shared services without per-command options
- `manager.ts`: orchestration for status, start, stop, restart, log tailing, and interactive tables
- `registry.ts`: the ordered list of shared services used by the CLI

The normal lifecycle is:

1. Read current status.
2. Optionally prepare files or derived config.
3. Decide whether an existing container can be reused.
4. Stop the old container if needed.
5. Run setup hooks.
6. Start the container.
7. Run post-start hooks.
8. Return any environment variables needed by callers.

When adding a service, keep Docker-specific behavior inside the service class instead of spreading it across commands or workflows.

As a rule of thumb:

- add a new service definition in `src/services/definitions/`
- register it in `src/services/registry.ts` if it is part of the shared baseline
- use `startServicesInteractive` or `restartServicesInteractive` when the command should show progress for multiple services
- use `startServices` or `stopServices` when the caller already controls user-facing output

### Development Config Contract

`src/config/development-config.ts` is the main contract exported by `@stamhoofd/cli` for the rest of the monorepo.

It is responsible for resolving:

- local domains
- port numbers
- backend environment variables
- frontend and backend app environment objects
- environment-specific presets such as platform name or user mode

Prefer putting local-development defaults there first and reading the resolved config elsewhere instead of re-deriving values in commands, services, app bootstrapping, or generated infrastructure config.

Good candidates for this file:

- anything that should stay consistent across app startup, status output, Caddy routing, and service helpers
- environment-specific local development behavior
- values consumed by backend or frontend dev builds through `@stamhoofd/cli`

Bad candidates for this file:

- one-off command-only formatting
- transient workflow state
- Docker lifecycle logic
- generic runtime helpers that are unrelated to development configuration

### Working On The CLI

`yarn install` builds `shared/cli` so normal CLI startup stays fast. When changing CLI source code, use `stam-dev` to rebuild before running:

```bash
yarn stam-dev --help
```

For CLI-only changes, run:

```bash
yarn --cwd shared/cli -s build
yarn --cwd shared/cli -s lint
yarn --cwd shared/cli -s test
```

CLI tests live next to source files as `*.test.ts`.

After changing CLI behavior, validate at least the package-local checks:

```bash
yarn --cwd shared/cli -s test
yarn --cwd shared/cli -s build
```

For command-surface changes, it is also useful to compare the generated help output with the README:

```bash
yarn stam --help
yarn stam services --help
yarn stam clean --help
```

## Troubleshooting

Use `yarn stam setup` first. It checks Node, Docker, Caddy, DNS, and certificate trust.

- **The active Node.js version differs from `.nvmrc`**

    Run `source .development/install-node.sh`. The script uses [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm), whichever is available. `stam status` also reports this mismatch, and `stam dev` will stop before starting processes with the wrong version.

If that does not tell you enough, use the first matching case below.

- DNS names like `dashboard.stamhoofd` do not resolve:
  Run `yarn stam setup dns`, then retry `yarn stam setup check`.
- `yarn stam setup` reports missing privileged port redirects on Linux:
  Let the setup command apply the recommended `sudo iptables` rules, then retry.
- HTTPS works badly or the browser does not trust local certificates:
  Run `yarn stam setup cert`, then retry `yarn stam setup check`.
- Docker commands fail or services do not start:
  Start Docker, retry the command, and use `yarn stam services status` to confirm which service is still down.
- Caddy fails to reload or URLs do not open locally:
  Check `yarn stam services status`, then try `yarn stam services restart`.
- URLs, instance names, or ports look wrong:
  Run `yarn stam status`, `yarn stam config explain`, and check whether `--env`, `--name`, or environment variables such as `STAMHOOFD_WORKSPACE_NAME` are overriding the inferred instance.
- Two workspaces conflict on ports:
  Check whether `STAMHOOFD_PORT_OFFSET` is forcing the same offset in multiple clones. Otherwise rerun the command and let automatic port allocation pick another bucket.
- Local database state is broken:
  Use `yarn stam clean db` for the selected instance or `yarn stam clean all` if generated state is broadly stale.
- Shared services state is broken:
  Use `yarn stam services restart`, or `yarn stam clean services` if volumes or generated service files need to be cleared manually.
- SSO redirect or Keycloak issues appear locally:
  Re-run `yarn stam sso config`, make sure the redirect URI still ends in `/openid/callback`, then restart SSO with `yarn stam sso start "<redirect-uri>"`.
- Stale build or type errors keep appearing after code changes:
  Run `yarn build:shared`, then retry the CLI command or app startup flow.
