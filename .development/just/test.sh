#!/usr/bin/env bash

test_prepare_database() {
    local container_name="${1:-$MYSQL_CONTAINER}"
    docker exec "$container_name" mysql -h127.0.0.1 -uroot -proot -e 'CREATE DATABASE IF NOT EXISTS `stamhoofd-tests` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'
}

test_start_services() {
    common_require_command docker
    echo "Starting isolated test MySQL..."
    docker rm -f "$TEST_MYSQL_CONTAINER" >/dev/null 2>&1 || true
    docker run -d \
        --name "$TEST_MYSQL_CONTAINER" \
        -e MYSQL_ROOT_PASSWORD=root \
        -p 127.0.0.1::3306 \
        mysql:8.4 \
        --mysql-native-password=ON \
        --sort-buffer-size=2M >/dev/null
    export DB_PORT="$(docker port "$TEST_MYSQL_CONTAINER" 3306/tcp | sed 's/.*://')"
    echo "Test MySQL is mapped to 127.0.0.1:${DB_PORT}."
    common_wait_for_mysql_container "$TEST_MYSQL_CONTAINER"
    test_prepare_database "$TEST_MYSQL_CONTAINER"
}

test_stop_services() {
    docker rm -f "$TEST_MYSQL_CONTAINER" >/dev/null 2>&1 || true
    echo "Test infrastructure stopped."
}

test_unit() {
    local ci="${1:-false}"
    local status=0

    test_start_services
    cleanup_done=0
    cleanup() {
        if [ "$cleanup_done" = "1" ]; then
            return
        fi
        cleanup_done=1
        trap - EXIT INT TERM
        test_stop_services
    }
    trap cleanup EXIT INT TERM

    if [ "$ci" = "true" ]; then
        CI=true NX_DAEMON=false yarn -s lerna run test --ignore @stamhoofd/playwright --ignore @stamhoofd/dashboard || status=$?
    else
        NX_DAEMON=false yarn -s lerna run test --ignore @stamhoofd/playwright --ignore @stamhoofd/dashboard || status=$?
    fi

    cleanup
    return "$status"
}

test_e2e() {
    local ci="${1:-false}"

    if [ "$ci" = "true" ]; then
        CI=true NX_DAEMON=false yarn -s test:playwright
    else
        NX_DAEMON=false yarn -s test:playwright
    fi
}
