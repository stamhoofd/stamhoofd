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

    resolvectl query "dashboard.${STAMHOOFD_DOMAIN}" 2>/dev/null | grep -q '127\.0\.0\.1'
}

dns_check_config() {
    if [ "$(uname -s)" != "Linux" ]; then
        return 1
    fi

    [ -f "$RESOLVED_RUNTIME_CONFIG" ] || return 1
    grep -Fxq 'DNS=127.0.0.1' "$RESOLVED_RUNTIME_CONFIG" || return 1
    grep -Fxq "Domains=~${STAMHOOFD_DOMAIN}" "$RESOLVED_RUNTIME_CONFIG" || return 1
}

dns_active_interface() {
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}'
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

dns_remove_networkmanager_entries() {
    command -v nmcli >/dev/null 2>&1 || return 0

    local interface connection
    interface="${STAMHOOFD_DNS_INTERFACE:-$(dns_active_interface)}"
    if [ -z "$interface" ]; then
        return 0
    fi

    connection="$(nmcli -t -f GENERAL.CONNECTION device show "$interface" 2>/dev/null | cut -d: -f2-)"
    if [ -z "$connection" ] || [ "$connection" = "--" ]; then
        return 0
    fi

    echo "Removing stale NetworkManager DNS entries from '$connection' if present..."
    if sudo -n true >/dev/null 2>&1; then
        sudo nmcli connection modify "$connection" -ipv4.dns 127.0.0.1 -ipv4.dns-search "~${STAMHOOFD_DOMAIN}" >/dev/null 2>&1 || true
        sudo nmcli connection up "$connection" >/dev/null 2>&1 || true
    else
        echo "Skipping stale NetworkManager cleanup until sudo credentials are available."
    fi
}

dns_status() {
    common_require_command resolvectl
    resolvectl status | sed -n "/DNS Servers\|DNS Domain\|~${STAMHOOFD_DOMAIN}/p"
}

dns_clean() {
    dns_require_linux_resolved
    echo "This will remove the temporary Stamhoofd systemd-resolved DNS config."
    echo "It will also remove stale NetworkManager entries for 127.0.0.1 and ~${STAMHOOFD_DOMAIN}."
    echo
    echo "Commands to run:"
    echo "  sudo rm -f ${RESOLVED_RUNTIME_CONFIG}"
    echo "  sudo systemctl restart systemd-resolved"
    echo
    if ! common_confirm "Remove this DNS configuration?"; then
        echo "DNS reset skipped."
        return 0
    fi

    dns_remove_networkmanager_entries
    sudo rm -f "$RESOLVED_RUNTIME_CONFIG"
    sudo systemctl restart systemd-resolved
    echo "Temporary Stamhoofd DNS config removed."
}
