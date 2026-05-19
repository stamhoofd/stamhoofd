#!/usr/bin/env bash

dev_write_caddyfile() {
    common_prepare_dev_dirs
    cat > "$GENERATED_DIR/Caddyfile" <<EOF
(dev_tls) {
    tls /etc/caddy/certs/stamhoofd-dev.crt /etc/caddy/certs/stamhoofd-dev.key
}

dashboard.${STAMHOOFD_DOMAIN}, *.dashboard.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:8080
}

api.${STAMHOOFD_DOMAIN}, *.api.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:9091
    header Cache-Control no-store
}

renderer.${STAMHOOFD_DOMAIN}, *.renderer.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:9093
}

*.registration.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:8081
}

shop.${STAMHOOFD_DOMAIN}, *.shop.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:8082
}

sso.${STAMHOOFD_DOMAIN} {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:5556
}

:80 {
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:8082
}

:443 {
    import dev_tls
    bind 127.0.0.1
    reverse_proxy 127.0.0.1:8082
}
EOF
}

dev_write_corefile() {
    common_prepare_dev_dirs
    cat > "$GENERATED_DIR/Corefile" <<'EOF'
stamhoofd {
    log

    template IN A {
        answer "{{ .Name }} 300 IN A 127.0.0.1"
    }

    template IN AAAA {
        answer "{{ .Name }} 300 IN AAAA ::1"
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
    echo "Starting MySQL on 127.0.0.1:3306..."
    docker rm -f "$MYSQL_CONTAINER" >/dev/null 2>&1 || true
    docker volume create "$MYSQL_VOLUME" >/dev/null
    docker run -d \
        --name "$MYSQL_CONTAINER" \
        -e MYSQL_ROOT_PASSWORD=root \
        -p 127.0.0.1:3306:3306 \
        -v "$MYSQL_VOLUME:/var/lib/mysql" \
        mysql:8.4 \
        --mysql-native-password=ON \
        --sort-buffer-size=2M >/dev/null
    dev_wait_for_mysql
}

dev_wait_for_mysql() {
    common_wait_for_mysql_container "$MYSQL_CONTAINER"
}

dev_start_maildev() {
    echo "Starting MailDev on 127.0.0.1:1080..."
    docker rm -f "$MAILDEV_CONTAINER" >/dev/null 2>&1 || true
    docker run -d \
        --name "$MAILDEV_CONTAINER" \
        -p 127.0.0.1:1025:1025 \
        -p 127.0.0.1:1080:1080 \
        maildev/maildev:2.2.1 \
        maildev --ip 0.0.0.0 --incoming-user username --incoming-pass password >/dev/null
}

dev_start_coredns() {
    echo "Starting CoreDNS on 127.0.0.1:53..."
    dev_write_corefile
    docker rm -f "$COREDNS_CONTAINER" >/dev/null 2>&1 || true
    docker run -d \
        --name "$COREDNS_CONTAINER" \
        -p 127.0.0.1:53:53/udp \
        -p 127.0.0.1:53:53/tcp \
        -v "$GENERATED_DIR/Corefile:/Corefile:ro" \
        coredns/coredns:1.11.3 \
        -conf /Corefile >/dev/null
}

dev_start_caddy() {
    echo "Starting Caddy on 127.0.0.1:80 and 127.0.0.1:443..."
    setup_require_dev_certificates
    dev_write_caddyfile
    docker rm -f "$CADDY_CONTAINER" >/dev/null 2>&1 || true
    docker volume create "$CADDY_DATA_VOLUME" >/dev/null
    docker volume create "$CADDY_CONFIG_VOLUME" >/dev/null
    docker run -d \
        --name "$CADDY_CONTAINER" \
        --network host \
        -v "$GENERATED_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
        -v "$CERT_DIR:/etc/caddy/certs:ro" \
        -v "$CADDY_DATA_VOLUME:/data" \
        -v "$CADDY_CONFIG_VOLUME:/config" \
        caddy:2.8 >/dev/null
}

dev_reload_caddy() {
    echo "Reloading Caddy configuration..."
    setup_require_dev_certificates
    dev_write_caddyfile
    docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile >/dev/null
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
    docker rm -f "$CADDY_CONTAINER" "$COREDNS_CONTAINER" >/dev/null 2>&1 || true
    echo "Network services stopped."
}

dev_start_backend_services() {
    common_require_command docker
    dev_start_mysql
    dev_start_maildev
    echo "Backend services started."
}

dev_stop_backend_services() {
    docker rm -f "$MAILDEV_CONTAINER" "$MYSQL_CONTAINER" >/dev/null 2>&1 || true
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

dev_run() {
    local target="$1"
    local env_name="$2"
    export STAMHOOFD_ENV="$env_name"
    export STAMHOOFD_SKIP_DEV_SERVICES=1
    cd "$ROOT_DIR"
    case "$target" in
        all)
            yarn -s dev
            ;;
        backend)
            npx concurrently -r \
                'yarn -s dev:init' \
                'yarn -s build:shared:watch' \
                'wait-on shared/locales/dist/index.d.ts && lerna run dev --scope @stamhoofd/backend --scope @stamhoofd/backend-renderer --stream --parallel'
            ;;
        frontend)
            npx concurrently -r \
                'yarn -s dev:init' \
                'yarn -s build:shared:watch' \
                'wait-on shared/locales/dist/index.d.ts && lerna run dev --scope @stamhoofd/dashboard --scope @stamhoofd/registration --scope @stamhoofd/webshop --stream --parallel'
            ;;
        *)
            echo "Unknown dev target: $target" >&2
            return 1
            ;;
    esac
}
