#!/usr/bin/env bash

dns_check() {
    if [ "$(uname -s)" != "Linux" ]; then
        return 1
    fi

    if ! command -v resolvectl >/dev/null 2>&1; then
        return 1
    fi

    if ! systemctl is-active --quiet systemd-resolved; then
        return 1
    fi

    resolvectl query "dashboard.${STAMHOOFD_DOMAIN}" 2>/dev/null | grep -Fq "$LOCAL_HOST"
}

dns_check_config() {
    if [ "$(uname -s)" != "Linux" ]; then
        return 1
    fi

    [ -f "$RESOLVED_RUNTIME_CONFIG" ] || return 1
    grep -Fxq "DNS=${LOCAL_HOST}" "$RESOLVED_RUNTIME_CONFIG" || return 1
    grep -Fxq "Domains=~${STAMHOOFD_DOMAIN}" "$RESOLVED_RUNTIME_CONFIG" || return 1
}

dns_active_interface() {
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}'
}

dns_active_connection() {
    command -v nmcli >/dev/null 2>&1 || return 1

    local interface connection
    interface="${STAMHOOFD_DNS_INTERFACE:-$(dns_active_interface)}"
    if [ -z "$interface" ]; then
        return 1
    fi

    connection="$(nmcli -t -f GENERAL.CONNECTION device show "$interface" 2>/dev/null | cut -d: -f2-)"
    if [ -z "$connection" ] || [ "$connection" = "--" ]; then
        return 1
    fi

    printf '%s' "$connection"
}

dns_require_linux_resolved() {
    if [ "$(uname -s)" != "Linux" ]; then
        echo "This DNS helper currently supports Linux only." >&2
        return 1
    fi
    common_require_command resolvectl
    if ! systemctl is-active --quiet systemd-resolved; then
        echo "systemd-resolved is not active. Split DNS setup was not changed." >&2
        return 1
    fi
}

dns_networkmanager_cleanup() {
    local mode="$1"
    local connection="$2"

    common_command "$mode" sudo nmcli connection modify "$connection" -ipv4.dns "$LOCAL_HOST" -ipv4.dns-search "~${STAMHOOFD_DOMAIN}"
    common_command "$mode" sudo nmcli connection up "$connection"
}

dns_remove_networkmanager_entries() {
    local mode="${1:-run}"
    local connection
    connection="$(dns_active_connection)" || return 0

    if [ "$mode" = "print" ]; then
        echo "  # May also run when NetworkManager has stale DNS entries:"
        dns_networkmanager_cleanup print "$connection"
        return 0
    fi

    echo "Removing stale NetworkManager DNS entries from '$connection' if present..."
    if sudo -n true >/dev/null 2>&1; then
        dns_networkmanager_cleanup run "$connection" >/dev/null 2>&1 || true
    else
        echo "Skipping stale NetworkManager cleanup until sudo credentials are available."
    fi
}

dns_remove_resolved_config() {
    local mode="$1"

    common_command "$mode" sudo rm -f "$RESOLVED_RUNTIME_CONFIG"
    common_command "$mode" sudo systemctl restart systemd-resolved
}

dns_status() {
    common_require_command resolvectl
    resolvectl status | sed -n "/DNS Servers\|DNS Domain\|~${STAMHOOFD_DOMAIN}/p"
}

dns_clean() {
    dns_require_linux_resolved
    echo "This will remove the temporary Stamhoofd systemd-resolved DNS config."
    echo "It will also remove stale NetworkManager entries for ${LOCAL_HOST} and ~${STAMHOOFD_DOMAIN}."
    echo
    echo "Commands to run:"
    dns_remove_networkmanager_entries print
    dns_remove_resolved_config print
    echo
    if ! common_confirm "Remove this DNS configuration?"; then
        echo "DNS reset skipped."
        return 0
    fi

    dns_remove_networkmanager_entries run
    dns_remove_resolved_config run
    echo "Temporary Stamhoofd DNS config removed."
}
