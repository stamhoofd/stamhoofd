#!/usr/bin/env bash

db_shell() {
    exec docker exec -it "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
}

db_clean() {
    echo "This will remove the local MySQL Docker volume: $MYSQL_VOLUME"
    if ! common_confirm "Continue?"; then
        echo "Database reset skipped."
        return 0
    fi
    common_docker_rm "$MYSQL_CONTAINER"
    common_command run docker volume rm "$MYSQL_VOLUME"
    echo "Database volume removed. Run: just dev backend --env stamhoofd"
}
