# Stamhoofd CLI

`stam` is the development CLI for this repository. It manages local setup, shared services, app processes, development configuration, database helpers, SSO helpers, tests, and cleanup.

## Quick Start

```bash
yarn install
yarn stam setup
yarn stam dev all
```

Open the dashboard URL printed by the CLI, or run `yarn stam status` to see active services, instances, URLs, and credentials.

Run `yarn stam --help` or `yarn stam <topic> --help` for command help.

## For CLI Users

### Commands

| Area | Command | Purpose |
| --- | --- | --- |
| Build | `yarn stam build` | Build shared packages and all app packages for the selected environment. |
| Setup | `yarn stam setup` | Check the machine and offer recommended setup fixes. |
| Setup | `yarn stam setup dns` | Configure local `.stamhoofd` DNS. |
| Setup | `yarn stam setup cert` | Trust the local Caddy HTTPS authority. |
| Development | `yarn stam dev all` | Start shared services and the full app stack. |
| Development | `yarn stam dev backend` | Start backend apps for the current instance. |
| Development | `yarn stam dev frontend` | Start frontend apps only. |
| Development | `yarn stam dev instance` | Start this workspace instance using shared services. |
| Services | `yarn stam services up` | Start shared Docker services. |
| Services | `yarn stam services status` | Show shared service status. |
| Services | `yarn stam services logs` | Tail shared service logs. |
| Services | `yarn stam services restart` | Restart shared services with interactive progress output. |
| Services | `yarn stam services down` | Stop shared services. |
| Services | `yarn stam services stop` | Alias for `yarn stam services down`. |
| Status | `yarn stam status` | Show shared services, active instances, URLs, and credentials. |
| Config | `yarn stam config explain` | Explain resolved instance config. |
| Config | `yarn stam config print` | Print resolved domains and backend environment values as JSON. |
| Database | `yarn stam db shell` | Open a MySQL shell for the current local database. |
| Database | `yarn stam db migrate` | Build shared packages and run migrations. |
| SSO | `yarn stam sso config` | Print local SSO client, user, and issuer settings. |
| SSO | `yarn stam sso start <redirect-uri>` | Start Keycloak and import the local realm. |
| SSO | `yarn stam sso logs` | Tail Keycloak logs. |
| SSO | `yarn stam sso stop` | Stop the local Keycloak container. |
| Tests | `yarn stam test unit` | Run unit tests with isolated MySQL. |
| Tests | `yarn stam test e2e` | Run Playwright tests. |
| Tests | `yarn stam test all --ci` | Run unit and E2E tests in CI mode. |
| Checks | `yarn stam check lint` | Run ESLint across the monorepo. |
| Checks | `yarn stam check typecheck` | Run TypeScript checks across the monorepo. |
| Checks | `yarn stam check all` | Run build, lint, typecheck, unit tests, and E2E tests. |
| Cleanup | `yarn stam clean build` | Remove build artifacts. |
| Cleanup | `yarn stam clean db` | Drop the selected local MySQL database after confirmation. |
| Cleanup | `yarn stam clean sso` | Stop the local SSO server. |
| Cleanup | `yarn stam clean services` | Stop shared services. |
| Cleanup | `yarn stam clean all` | Clean build artifacts and stop shared services. |

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

The primary `stamhoofd` instance uses base ports. With Git, the primary instance is the first worktree in `git worktree list --porcelain`. With jj, it is the first workspace in `jj workspace list`. Other worktrees and workspaces get deterministic offsets based on the workspace name so multiple workspaces can run on the same machine without changing databases when branches change.

### Shared Services

Shared services run as Docker containers:

- MySQL: `stamhoofd-mysql`
- MailDev: `stamhoofd-maildev`
- RustFS: `stamhoofd-rustfs`
- CoreDNS: `stamhoofd-coredns`
- Caddy: `stamhoofd-caddy`

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

### Tests

Unit tests start an isolated MySQL container, create `stamhoofd-tests`, run tests with the mapped `DB_PORT`, and remove the container afterward:

```bash
yarn stam test unit
```

Run Playwright tests with:

```bash
yarn stam test e2e
```

The e2e command keeps its MySQL container and data volume between runs so migrated worker databases can be reused. Reset that persistent e2e database with:

```bash
yarn stam test e2e --clear
```

Use `--workers <number>` to override Playwright's default worker count for a run.
Use `--extra` to include tests tagged `@extra`.

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

Use `yarn stam setup check` first. It checks Node, Yarn, Docker, Caddy, DNS, and certificate trust.

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
