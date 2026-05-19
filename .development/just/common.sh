#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENERATED_DIR="$ROOT_DIR/.development/just/generated"
CERT_DIR="$GENERATED_DIR/certs"
DEV_CA_CRT="$CERT_DIR/stamhoofd-dev-ca.crt"
DEV_CA_KEY="$CERT_DIR/stamhoofd-dev-ca.key"
DEV_CA_SERIAL="$CERT_DIR/stamhoofd-dev-ca.srl"
DEV_CERT_CRT="$CERT_DIR/stamhoofd-dev.crt"
DEV_CERT_KEY="$CERT_DIR/stamhoofd-dev.key"
DEV_CERT_CSR="$CERT_DIR/stamhoofd-dev.csr"
DEV_CERT_EXT="$CERT_DIR/stamhoofd-dev.ext"
TRUSTED_DEV_CA_CRT="/usr/local/share/ca-certificates/stamhoofd-dev-ca.crt"
TRUSTED_DEV_CA_PEM="/etc/ssl/certs/stamhoofd-dev-ca.pem"
RESOLVED_RUNTIME_CONFIG_DIR="/run/systemd/resolved.conf.d"
RESOLVED_RUNTIME_CONFIG="/run/systemd/resolved.conf.d/stamhoofd.conf"
KEYCLOAK_IMPORT_DIR="$GENERATED_DIR/keycloak"
KEYCLOAK_REALM_CONFIG="$KEYCLOAK_IMPORT_DIR/stamhoofd-realm.json"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.4}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MAILDEV_IMAGE="${MAILDEV_IMAGE:-maildev/maildev:2.2.1}"
COREDNS_IMAGE="${COREDNS_IMAGE:-coredns/coredns:1.11.3}"
CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.8}"

STAMHOOFD_DEV_NAME="${STAMHOOFD_DEV_NAME:-stamhoofd}"
STAMHOOFD_DOMAIN="${STAMHOOFD_DOMAIN:-stamhoofd}"
LOCAL_HOST="${LOCAL_HOST:-127.0.0.1}"
LOCAL_IPV6_HOST="${LOCAL_IPV6_HOST:-::1}"

DASHBOARD_PORT="${DASHBOARD_PORT:-8080}"
REGISTRATION_PORT="${REGISTRATION_PORT:-8081}"
SHOP_PORT="${SHOP_PORT:-8082}"
API_PORT="${API_PORT:-9091}"
RENDERER_PORT="${RENDERER_PORT:-9093}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_CONTAINER_PORT="${MYSQL_CONTAINER_PORT:-3306}"
MYSQL_CLIENT_HOST="${MYSQL_CLIENT_HOST:-127.0.0.1}"
DNS_PORT="${DNS_PORT:-53}"
MAILDEV_SMTP_PORT="${MAILDEV_SMTP_PORT:-1025}"
MAILDEV_HTTP_PORT="${MAILDEV_HTTP_PORT:-1080}"
MAILDEV_CONTAINER_SMTP_PORT="${MAILDEV_CONTAINER_SMTP_PORT:-1025}"
MAILDEV_CONTAINER_HTTP_PORT="${MAILDEV_CONTAINER_HTTP_PORT:-1080}"
SSO_PORT="${SSO_PORT:-5556}"
KEYCLOAK_CONTAINER_PORT="${KEYCLOAK_CONTAINER_PORT:-8080}"

MYSQL_CONTAINER="${STAMHOOFD_DEV_NAME}-mysql"
MAILDEV_CONTAINER="${STAMHOOFD_DEV_NAME}-maildev"
CADDY_CONTAINER="${STAMHOOFD_DEV_NAME}-caddy"
COREDNS_CONTAINER="${STAMHOOFD_DEV_NAME}-coredns"
KEYCLOAK_CONTAINER="${STAMHOOFD_DEV_NAME}-keycloak"
TEST_MYSQL_CONTAINER="${STAMHOOFD_TEST_MYSQL_CONTAINER:-${STAMHOOFD_DEV_NAME}-test-mysql-$$}"

MYSQL_VOLUME="${STAMHOOFD_DEV_NAME}-mysql-data"
CADDY_DATA_VOLUME="${STAMHOOFD_DEV_NAME}-caddy-data"
CADDY_CONFIG_VOLUME="${STAMHOOFD_DEV_NAME}-caddy-config"
KEYCLOAK_IMAGE="${KEYCLOAK_IMAGE:-quay.io/keycloak/keycloak:26.0.7}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-stamhoofd}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-stamhoofd-local}"
KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-stamhoofd-local-secret}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
KEYCLOAK_USER_EMAIL="${KEYCLOAK_USER_EMAIL:-sso@example.com}"
KEYCLOAK_USER_PASSWORD="${KEYCLOAK_USER_PASSWORD:-password}"
KEYCLOAK_USER_NAME="${KEYCLOAK_USER_NAME:-Local SSO User}"
KEYCLOAK_USER_ID="${KEYCLOAK_USER_ID:-local-sso-user}"

DASHBOARD_URL="https://dashboard.${STAMHOOFD_DOMAIN}"
API_URL="https://api.${STAMHOOFD_DOMAIN}"
RENDERER_URL="https://renderer.${STAMHOOFD_DOMAIN}"
MAILDEV_URL="http://${LOCAL_HOST}:${MAILDEV_HTTP_PORT}"
SSO_BASE_URL="https://sso.${STAMHOOFD_DOMAIN}/dex"
SSO_ADMIN_URL="${SSO_BASE_URL}/admin"
SSO_EXAMPLE_REDIRECT_URI="https://<organization-id>.api.${STAMHOOFD_DOMAIN}/openid/callback"
CADDY_CERT_DIR="/etc/caddy/certs"
CADDY_DEV_CERT_CRT="$CADDY_CERT_DIR/$(basename "$DEV_CERT_CRT")"
CADDY_DEV_CERT_KEY="$CADDY_CERT_DIR/$(basename "$DEV_CERT_KEY")"

common_confirm() {
    local prompt="$1"
    local answer
    read -r -p "$prompt [y/N] " answer
    case "$answer" in
        y|Y|yes|YES) return 0 ;;
        *) return 1 ;;
    esac
}

common_require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        return 1
    fi
}

common_print_command() {
    local separator='  '
    local argument
    for argument in "$@"; do
        printf '%s%q' "$separator" "$argument"
        separator=' '
    done
    printf '\n'
}

common_print_run_command() {
    if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
        printf '\033[2m'
        common_print_command "$@"
        printf '\033[0m'
    else
        common_print_command "$@"
    fi
}

common_command() {
    local mode="$1"
    shift

    case "$mode" in
        print)
            common_print_command "$@"
            ;;
        run)
            common_print_run_command "$@"
            "$@"
            ;;
        *)
            echo "Unknown command mode: $mode" >&2
            return 1
            ;;
    esac
}

common_command_quiet() {
    local mode="$1"
    shift

    case "$mode" in
        print)
            common_print_command "$@"
            ;;
        run)
            common_print_run_command "$@"
            "$@" >/dev/null
            ;;
        *)
            echo "Unknown command mode: $mode" >&2
            return 1
            ;;
    esac
}

common_docker_rm() {
    common_print_run_command docker rm -f "$@"
    docker rm -f "$@" >/dev/null 2>&1 || true
}

common_docker_volume_create() {
    common_command_quiet run docker volume create "$1"
}

common_container_is_running() {
    local container_name="$1"
    [ "$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || true)" = "true" ]
}

common_prepare_dev_dirs() {
    mkdir -p "$GENERATED_DIR"
}

common_json_string() {
    node -e 'process.stdout.write(JSON.stringify(process.argv[1] ?? ""))' "$1"
}

common_wait_for_mysql_container() {
    local container_name="$1"
    echo "Waiting for MySQL to accept connections..."
    for _ in {1..60}; do
        if docker exec "$container_name" mysql -h"$MYSQL_CLIENT_HOST" -uroot -p"$MYSQL_ROOT_PASSWORD" -e 'SELECT 1' >/dev/null 2>&1; then
            echo "MySQL is ready."
            return 0
        fi
        sleep 1
    done

    echo "MySQL did not become ready in time." >&2
    docker logs "$container_name" >&2 || true
    return 1
}

common_start_mysql_container() {
    local container_name="$1"
    local port_mapping="$2"
    local volume_mount="${3:-}"

    local docker_args=(
        run -d
        --name "$container_name"
        -e "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"
        -p "$port_mapping"
    )

    if [ -n "$volume_mount" ]; then
        docker_args+=(
            -v "$volume_mount"
        )
    fi

    docker_args+=(
        "$MYSQL_IMAGE"
        --mysql-native-password=ON
        --sort-buffer-size=2M
    )

    common_command_quiet run docker "${docker_args[@]}"
}
