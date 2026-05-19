#!/usr/bin/env bash

test_prepare_database() {
    local container_name="${1:-$MYSQL_CONTAINER}"
    docker exec "$container_name" mysql -h"$MYSQL_CLIENT_HOST" -uroot -p"$MYSQL_ROOT_PASSWORD" -e 'CREATE DATABASE IF NOT EXISTS `stamhoofd-tests` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'
}

test_start_services() {
    common_require_command docker
    echo "Starting isolated test MySQL..."
    common_docker_rm "$TEST_MYSQL_CONTAINER"
    common_start_mysql_container "$TEST_MYSQL_CONTAINER" "${LOCAL_HOST}::${MYSQL_CONTAINER_PORT}"
    export DB_PORT="$(docker port "$TEST_MYSQL_CONTAINER" 3306/tcp | sed 's/.*://')"
    echo "Test MySQL is mapped to ${LOCAL_HOST}:${DB_PORT}."
    common_wait_for_mysql_container "$TEST_MYSQL_CONTAINER"
    test_prepare_database "$TEST_MYSQL_CONTAINER"
}

test_stop_services() {
    common_docker_rm "$TEST_MYSQL_CONTAINER"
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
