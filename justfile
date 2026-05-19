# Stamhoofd justfile - contributor-facing task runner
# Install just: https://just.systems/man/en/packages.html
# Usage: just <recipe>

set shell := ["bash", "-euo", "pipefail", "-c"]

export STAMHOOFD_DEV_NAME := env_var_or_default("STAMHOOFD_DEV_NAME", "stamhoofd")
export STAMHOOFD_DOMAIN := env_var_or_default("STAMHOOFD_DOMAIN", "stamhoofd")
dev_script := ".development/just/load.sh"

# Show beginner help and list contributor-facing recipes
default:
    @printf '%s\n' 'Stamhoofd local development'
    @printf '\n%s\n' 'First time setup:'
    @printf '%s\n' '  just install            Install Node dependencies'
    @printf '%s\n' '  just setup check        Check required tools and local configuration'
    @printf '%s\n' '  just setup dns          Configure local .stamhoofd DNS'
    @printf '%s\n' '  just setup cert         Generate and trust local HTTPS certificates'
    @printf '\n%s\n' 'Start developing:'
    @printf '%s\n' '  just dev all            Start the full local stack'
    @printf '%s\n' '  just dev backend        Start backend services and backend apps'
    @printf '%s\n' '  just dev frontend       Start frontend apps only'
    @printf '%s\n' '  just status             Show local URLs, containers, and DNS status'
    @printf '\n%s\n' 'Check your work:'
    @printf '%s\n' '  just check all          Build, lint, typecheck, unit tests, and E2E tests'
    @printf '%s\n' '  just validate           Alias for just check all'
    @printf '\n%s\n' 'Cleanup:'
    @printf '%s\n' '  just clean              Show cleanup commands'
    @printf '%s\n' '  just clean build        Remove build artifacts'
    @printf '%s\n' '  just clean all          Clean all local generated/development state'
    @printf '\n%s\n' 'Tips:'
    @printf '%s\n' '  Commands with subcommands show usage when run without a subcommand.'
    @printf '%s\n' '  Use --env <name> with dev commands, e.g. just dev all --env keeo.'
    @printf '%s\n' '  Run just --usage <command> for command arguments.'
    @printf '%s\n' '  Run just --list to see every command.'
    @printf '\n'
    @just --list

# ── Setup ─────────────────────────────────────────────────────────────────────

[arg("target", help="check | dns | cert")]
[doc("Install/check local development prerequisites.")]
setup target="":
    #!/usr/bin/env bash
    if [ -z "{{ target }}" ]; then
      just --usage setup
      exit 0
    fi
    case "{{ target }}" in
      check) just _setup-check ;;
      dns) just _setup-dns ;;
      cert) just _setup-cert ;;
      *) echo "Unknown setup target: {{ target }}" >&2; exit 1 ;;
    esac

[arg("action", help="status | clean")]
[doc("Inspect or clean local .stamhoofd DNS configuration.")]
dns action="":
    #!/usr/bin/env bash
    if [ -z "{{ action }}" ]; then
      just --usage dns
      exit 0
    fi
    case "{{ action }}" in
      status) just _dns-status ;;
      clean) just _dns-clean ;;
      *) echo "Unknown dns action: {{ action }}" >&2; exit 1 ;;
    esac

# ── Infrastructure ────────────────────────────────────────────────────────────

# Show local development status
status:
    #!/usr/bin/env bash
    source {{ dev_script }}
    status

[arg("action", help="start | stop | logs | config | clean")]
[arg("redirect_uri", help="Redirect URI copied from the SSO settings view")]
[arg("background", long, value="true", help="Run the local SSO server in the background")]
[doc("Manage a local OpenID Connect server for SSO testing.")]
sso action="" redirect_uri="" background="false":
    #!/usr/bin/env bash
    if [ -z "{{ action }}" ]; then
      just --usage sso
      exit 0
    fi
    case "{{ action }}" in
      start) just _sso-start "{{ redirect_uri }}" {{ background }} ;;
      stop) just _sso-stop ;;
      logs) just _sso-logs ;;
      config) just _sso-config "{{ redirect_uri }}" ;;
      clean) just _sso-clean ;;
      *) echo "Unknown sso action: {{ action }}" >&2; exit 1 ;;
    esac

# ── Development ───────────────────────────────────────────────────────────────

[arg("target", help="all | network | backend | frontend")]
[arg("env", long, help="Development environment")]
[doc("Run local development for the selected target.")]
dev target="" env="stamhoofd":
    #!/usr/bin/env bash
    if [ -z "{{ target }}" ]; then
      just --usage dev
      exit 0
    fi
    case "{{ target }}" in
      all|network|backend|frontend) just _dev {{ target }} {{ env }} ;;
      *) echo "Unknown dev target: {{ target }}" >&2; exit 1 ;;
    esac

[arg("action", help="shell | migrate | clean")]
[doc("Manage the local development database.")]
db action="":
    #!/usr/bin/env bash
    if [ -z "{{ action }}" ]; then
      just --usage db
      exit 0
    fi
    case "{{ action }}" in
      shell) just _db-shell ;;
      migrate) just _db-migrate ;;
      clean) just _db-clean ;;
      *) echo "Unknown database action: {{ action }}" >&2; exit 1 ;;
    esac

# ── Build & Validation ────────────────────────────────────────────────────────

[arg("target", help="all | lint | typecheck | build")]
[doc("Run validation checks for the selected target.")]
check target="":
    #!/usr/bin/env bash
    if [ -z "{{ target }}" ]; then
      just --usage check
      exit 0
    fi
    case "{{ target }}" in
      all) just _check-all ;;
      lint) just _check-lint ;;
      typecheck) just _check-typecheck ;;
      build) just _build ;;
      *) echo "Unknown check target: {{ target }}" >&2; exit 1 ;;
    esac

[arg("target", help="all | unit | e2e")]
[arg("ci", long, value="true", help="Use non-interactive CI-style test execution")]
[doc("Run tests for the selected target.")]
test target="" ci="false":
    #!/usr/bin/env bash
    if [ -z "{{ target }}" ]; then
      just --usage test
      exit 0
    fi
    case "{{ target }}" in
      all) just _test-all {{ ci }} ;;
      unit) just _test-unit {{ ci }} ;;
      e2e) just _test-e2e {{ ci }} ;;
      *) echo "Unknown test target: {{ target }}" >&2; exit 1 ;;
    esac

# Install Node dependencies
install:
    yarn install

# Run the full local validation flow; alias for `just check all`
[doc("Alias for `just check all`.")]
validate: _check-all

[arg("target", help="all | build | db | dns | sso")]
[doc("Clean local generated state for the selected target.")]
clean target="":
    #!/usr/bin/env bash
    if [ -z "{{ target }}" ]; then
      just --usage clean
      exit 0
    fi
    case "{{ target }}" in
      all) just _clean-all ;;
      build) just _clean-build ;;
      db) just db clean ;;
      dns) just dns clean ;;
      sso) just sso clean ;;
      *) echo "Unknown clean target: {{ target }}" >&2; exit 1 ;;
    esac

[private]
_setup-check:
    #!/usr/bin/env bash
    source {{ dev_script }}
    setup_check

[private]
_setup-dns:
    #!/usr/bin/env bash
    source {{ dev_script }}
    setup_dns

[private]
_setup-cert:
    #!/usr/bin/env bash
    source {{ dev_script }}
    setup_cert

[private]
_dns-status:
    #!/usr/bin/env bash
    source {{ dev_script }}
    dns_status

[private]
_dns-clean:
    #!/usr/bin/env bash
    source {{ dev_script }}
    dns_clean

[private]
_sso-start redirect_uri background:
    #!/usr/bin/env bash
    source {{ dev_script }}
    sso_start "{{ redirect_uri }}" "{{ background }}"

[private]
_sso-stop:
    #!/usr/bin/env bash
    source {{ dev_script }}
    sso_stop

[private]
_sso-clean:
    just _sso-stop

[private]
_sso-logs:
    #!/usr/bin/env bash
    source {{ dev_script }}
    sso_logs

[private]
_sso-config redirect_uri:
    #!/usr/bin/env bash
    source {{ dev_script }}
    sso_config "{{ redirect_uri }}"

[private]
_dev target env:
    #!/usr/bin/env bash
    source {{ dev_script }}
    case "{{ target }}" in
      all)
        dev_start_network_services
        dev_start_backend_services
        cleanup_done=0
        cleanup() { if [ "$cleanup_done" = "1" ]; then return; fi; cleanup_done=1; trap - EXIT INT TERM; dev_stop_backend_services; dev_stop_network_services; }
        trap cleanup EXIT INT TERM
        dev_run all "{{ env }}"
        ;;
      network)
        dev_start_network_services
        cleanup_done=0
        cleanup() { if [ "$cleanup_done" = "1" ]; then return; fi; cleanup_done=1; trap - EXIT INT TERM; dev_stop_network_services; }
        trap cleanup EXIT INT TERM
        dev_tail_network_logs
        ;;
      backend)
        dev_start_backend_services
        cleanup_done=0
        cleanup() { if [ "$cleanup_done" = "1" ]; then return; fi; cleanup_done=1; trap - EXIT INT TERM; dev_stop_backend_services; }
        trap cleanup EXIT INT TERM
        dev_run backend "{{ env }}"
        ;;
      frontend)
        dev_run frontend "{{ env }}"
        ;;
    esac

[private]
_db-shell:
    #!/usr/bin/env bash
    source {{ dev_script }}
    db_shell

[private]
_db-migrate:
    yarn -s migrate

[private]
_db-clean:
    #!/usr/bin/env bash
    source {{ dev_script }}
    db_clean

[private]
_clean-build:
    yarn clear

[private]
_clean-all:
    just _clean-build
    just db clean
    just dns clean
    just sso clean

[private]
_build:
    NX_DAEMON=false yarn dev:build

[private]
_check-lint:
    NX_DAEMON=false yarn lint

[private]
_check-typecheck:
    NX_DAEMON=false yarn typecheck

[private]
_check-all:
    just _build
    just _check-lint
    just _check-typecheck
    just _test-all true

[private]
_test-unit ci:
    #!/usr/bin/env bash
    source {{ dev_script }}
    test_unit "{{ ci }}"

[private]
_test-e2e ci:
    #!/usr/bin/env bash
    source {{ dev_script }}
    test_e2e "{{ ci }}"

[private]
_test-all ci:
    just _test-unit {{ ci }}
    just _test-e2e {{ ci }}
