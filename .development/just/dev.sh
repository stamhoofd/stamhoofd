#!/usr/bin/env bash

dev_write_caddyfile() {
    common_prepare_dev_dirs
    cat > "$GENERATED_DIR/Caddyfile" <<EOF
(dev_tls) {
    tls ${CADDY_DEV_CERT_CRT} ${CADDY_DEV_CERT_KEY}
}

dashboard.${STAMHOOFD_DOMAIN}, *.dashboard.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${DASHBOARD_PORT}
}

api.${STAMHOOFD_DOMAIN}, *.api.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${API_PORT}
    header Cache-Control no-store
}

renderer.${STAMHOOFD_DOMAIN}, *.renderer.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${RENDERER_PORT}
}

*.registration.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${REGISTRATION_PORT}
}

shop.${STAMHOOFD_DOMAIN}, *.shop.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${SHOP_PORT}
}

sso.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${SSO_PORT}
}

:80 {
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${SHOP_PORT}
}

:443 {
    import dev_tls
    bind ${LOCAL_HOST}
    reverse_proxy ${LOCAL_HOST}:${SHOP_PORT}
}
EOF
}

dev_write_corefile() {
    common_prepare_dev_dirs
    cat > "$GENERATED_DIR/Corefile" <<EOF
${STAMHOOFD_DOMAIN} {
    log

    template IN A {
        answer "{{ .Name }} 300 IN A ${LOCAL_HOST}"
    }

    template IN AAAA {
        answer "{{ .Name }} 300 IN AAAA ${LOCAL_IPV6_HOST}"
    }
}

use-application-dns.net {
    log
}

. {
    forward . 8.8.8.8 9.9.9.9
}
EOF
}

dev_start_mysql() {
    echo "Starting MySQL on ${LOCAL_HOST}:${MYSQL_PORT}..."
    common_docker_rm "$MYSQL_CONTAINER"
    common_docker_volume_create "$MYSQL_VOLUME"
    common_start_mysql_container "$MYSQL_CONTAINER" "${LOCAL_HOST}:${MYSQL_PORT}:${MYSQL_CONTAINER_PORT}" "$MYSQL_VOLUME:/var/lib/mysql"
    dev_wait_for_mysql
}

dev_wait_for_mysql() {
    common_wait_for_mysql_container "$MYSQL_CONTAINER"
}

dev_start_maildev() {
    echo "Starting MailDev on ${MAILDEV_URL}..."
    common_docker_rm "$MAILDEV_CONTAINER"
    common_command_quiet run docker run -d \
        --name "$MAILDEV_CONTAINER" \
        -p "${LOCAL_HOST}:${MAILDEV_SMTP_PORT}:${MAILDEV_CONTAINER_SMTP_PORT}" \
        -p "${LOCAL_HOST}:${MAILDEV_HTTP_PORT}:${MAILDEV_CONTAINER_HTTP_PORT}" \
        "$MAILDEV_IMAGE" \
        maildev --ip 0.0.0.0 --incoming-user username --incoming-pass password
}

dev_start_coredns() {
    echo "Starting CoreDNS on ${LOCAL_HOST}:${DNS_PORT}..."
    dev_write_corefile
    common_docker_rm "$COREDNS_CONTAINER"
    common_command_quiet run docker run -d \
        --name "$COREDNS_CONTAINER" \
        -p "${LOCAL_HOST}:${DNS_PORT}:53/udp" \
        -p "${LOCAL_HOST}:${DNS_PORT}:53/tcp" \
        -v "$GENERATED_DIR/Corefile:/Corefile:ro" \
        "$COREDNS_IMAGE" \
        -conf /Corefile
}

dev_start_caddy() {
    echo "Starting Caddy on ${LOCAL_HOST}:80 and ${LOCAL_HOST}:443..."
    setup_require_dev_certificates
    dev_write_caddyfile
    common_docker_rm "$CADDY_CONTAINER"
    common_docker_volume_create "$CADDY_DATA_VOLUME"
    common_docker_volume_create "$CADDY_CONFIG_VOLUME"
    common_command_quiet run docker run -d \
        --name "$CADDY_CONTAINER" \
        --network host \
        -v "$GENERATED_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
        -v "$CERT_DIR:$CADDY_CERT_DIR:ro" \
        -v "$CADDY_DATA_VOLUME:/data" \
        -v "$CADDY_CONFIG_VOLUME:/config" \
        "$CADDY_IMAGE"
}

dev_reload_caddy() {
    echo "Reloading Caddy configuration..."
    setup_require_dev_certificates
    dev_write_caddyfile
    common_command_quiet run docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
}

dev_start_network_services() {
    common_require_command docker
    dev_ensure_network_services
    echo "Network services started."
}

dev_ensure_network_services() {
    common_require_command docker

    if common_container_is_running "$COREDNS_CONTAINER"; then
        echo "CoreDNS is already running."
    else
        dev_start_coredns
    fi

    if common_container_is_running "$CADDY_CONTAINER"; then
        dev_reload_caddy
    else
        dev_start_caddy
    fi
}

dev_stop_network_services() {
    common_docker_rm "$CADDY_CONTAINER" "$COREDNS_CONTAINER"
    echo "Network services stopped."
}

dev_start_backend_services() {
    common_require_command docker
    dev_start_mysql
    dev_start_maildev
    echo "Backend services started."
}

dev_stop_backend_services() {
    common_docker_rm "$MAILDEV_CONTAINER" "$MYSQL_CONTAINER"
    echo "Backend services stopped."
}

dev_tail_logs() {
    docker logs -f "$MYSQL_CONTAINER" &
    local mysql_logs_pid=$!
    docker logs -f "$MAILDEV_CONTAINER" &
    local maildev_logs_pid=$!
    docker logs -f "$COREDNS_CONTAINER" &
    local coredns_logs_pid=$!
    docker logs -f "$CADDY_CONTAINER" &
    local caddy_logs_pid=$!
    trap 'kill "$mysql_logs_pid" "$maildev_logs_pid" "$coredns_logs_pid" "$caddy_logs_pid" 2>/dev/null || true' RETURN
    wait "$mysql_logs_pid" "$maildev_logs_pid" "$coredns_logs_pid" "$caddy_logs_pid"
}

dev_tail_network_logs() {
    docker logs -f "$COREDNS_CONTAINER" &
    local coredns_logs_pid=$!
    docker logs -f "$CADDY_CONTAINER" &
    local caddy_logs_pid=$!
    trap 'kill "$coredns_logs_pid" "$caddy_logs_pid" 2>/dev/null || true' RETURN
    wait "$coredns_logs_pid" "$caddy_logs_pid"
}

dev_run_concurrently() {
    local lerna_command="$1"

    common_command run npx --no-install concurrently -r \
        'yarn -s dev:init' \
        'yarn -s build:shared:watch' \
        "wait-on shared/locales/dist/index.d.ts && $lerna_command"
}

dev_run() {
    local target="$1"
    local env_name="$2"
    export STAMHOOFD_ENV="$env_name"
    export STAMHOOFD_SKIP_DEV_SERVICES=1
    export npm_config_script_shell="${npm_config_script_shell:-/bin/bash}"
    cd "$ROOT_DIR"
    case "$target" in
        all)
            dev_run_concurrently 'lerna run dev --ignore @stamhoofd/calculator --stream --parallel'
            ;;
        backend)
            dev_run_concurrently 'lerna run dev --scope @stamhoofd/backend --scope @stamhoofd/backend-renderer --stream --parallel'
            ;;
        frontend)
            dev_run_concurrently 'lerna run dev --scope @stamhoofd/dashboard --scope @stamhoofd/registration --scope @stamhoofd/webshop --stream --parallel'
            ;;
        *)
            echo "Unknown dev target: $target" >&2
            return 1
            ;;
    esac
}
