#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENERATED_DIR="$ROOT_DIR/.development/just/generated"
CERT_DIR="$GENERATED_DIR/certs"
DEV_CA_CRT="$CERT_DIR/stamhoofd-dev-ca.crt"
DEV_CA_KEY="$CERT_DIR/stamhoofd-dev-ca.key"
DEV_CERT_CRT="$CERT_DIR/stamhoofd-dev.crt"
DEV_CERT_KEY="$CERT_DIR/stamhoofd-dev.key"
DEV_CERT_CSR="$CERT_DIR/stamhoofd-dev.csr"
DEV_CERT_EXT="$CERT_DIR/stamhoofd-dev.ext"
TRUSTED_DEV_CA_CRT="/usr/local/share/ca-certificates/stamhoofd-dev-ca.crt"
RESOLVED_RUNTIME_CONFIG="/run/systemd/resolved.conf.d/stamhoofd.conf"
KEYCLOAK_IMPORT_DIR="$GENERATED_DIR/keycloak"
KEYCLOAK_REALM_CONFIG="$KEYCLOAK_IMPORT_DIR/stamhoofd-realm.json"

STAMHOOFD_DEV_NAME="${STAMHOOFD_DEV_NAME:-stamhoofd}"
STAMHOOFD_DOMAIN="${STAMHOOFD_DOMAIN:-stamhoofd}"

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
        if docker exec "$container_name" mysql -h127.0.0.1 -uroot -proot -e 'SELECT 1' >/dev/null 2>&1; then
            echo "MySQL is ready."
            return 0
        fi
        sleep 1
    done

    echo "MySQL did not become ready in time." >&2
    docker logs "$container_name" >&2 || true
    return 1
}
