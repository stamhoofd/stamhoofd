#!/usr/bin/env bash

status_show_dev_services() {
    docker ps --filter "name=${STAMHOOFD_DEV_NAME}-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

status() {
    echo "Dev name:    $STAMHOOFD_DEV_NAME"
    echo "Domain:      .$STAMHOOFD_DOMAIN"
    echo
    echo "URLs:"
    echo "  Dashboard: ${DASHBOARD_URL}"
    echo "  API:       ${API_URL}"
    echo "  Renderer:  ${RENDERER_URL}"
    echo "  SSO:       $(sso_issuer)"
    echo "  MailDev:   ${MAILDEV_URL}"
    echo
    echo "Containers:"
    status_show_dev_services || true
    echo
    echo "DNS:"
    if command -v resolvectl >/dev/null 2>&1; then
        dns_status || true
    else
        echo "  resolvectl not found"
    fi
}
