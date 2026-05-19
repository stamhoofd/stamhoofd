#!/usr/bin/env bash

setup_check() {
    local missing=0
    for command_name in docker node yarn just; do
        if ! command -v "$command_name" >/dev/null 2>&1; then
            echo "Missing: $command_name"
            missing=1
        else
            echo "Found: $command_name ($(command -v "$command_name"))"
        fi
    done

    if [ -f "$ROOT_DIR/.nvmrc" ]; then
        local expected_node current_node
        expected_node="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
        current_node="$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1 || true)"
        if [ -n "$current_node" ] && [ "$current_node" != "$expected_node" ]; then
            echo "Node major version is $current_node, expected $expected_node from .nvmrc"
        fi
    fi

    if [ -d "$ROOT_DIR/node_modules" ]; then
        echo "Node dependencies: installed."
    else
        echo "Node dependencies: missing. Run: just install"
        missing=1
    fi

    if ! docker info >/dev/null 2>&1; then
        echo "Docker is not available or the daemon is not reachable."
        missing=1
    fi

    if dns_check; then
        echo "DNS: split DNS for .${STAMHOOFD_DOMAIN} is configured."
    elif dns_check_config; then
        echo "DNS: split DNS for .${STAMHOOFD_DOMAIN} seems to be configured, but the DNS server is not running so it cannot be fully checked."
        echo "DNS: start it with 'just dev network' or 'just dev all'."
    else
        echo "DNS: split DNS for .${STAMHOOFD_DOMAIN} is not configured. Run: just setup dns"
        missing=1
    fi

    if setup_check_cert; then
        echo "Certificate: Stamhoofd development CA exists and appears to be trusted."
    else
        echo "Certificate: Stamhoofd development CA is missing or not trusted. Run: just setup cert"
        missing=1
    fi

    if [ "$missing" = "0" ]; then
        echo
        echo "Next steps:"
        echo "  just dev all"
        echo "  just"
    fi
    return "$missing"
}

setup_prepare_cert_dir() {
    mkdir -p "$CERT_DIR"
    chmod 700 "$CERT_DIR"
}

setup_check_cert() {
    if [ "$(uname -s)" != "Linux" ]; then
        return 1
    fi

    [ -f "$DEV_CA_CRT" ] || return 1
    [ -f "$DEV_CA_KEY" ] || return 1
    [ -f "$DEV_CERT_CRT" ] || return 1
    [ -f "$DEV_CERT_KEY" ] || return 1

    if [ -f "$TRUSTED_DEV_CA_CRT" ]; then
        cmp -s "$DEV_CA_CRT" "$TRUSTED_DEV_CA_CRT" && return 0
    fi

    if [ -f "$TRUSTED_DEV_CA_PEM" ]; then
        cmp -s "$DEV_CA_CRT" "$TRUSTED_DEV_CA_PEM" && return 0
    fi

    if command -v trust >/dev/null 2>&1; then
        trust list 2>/dev/null | grep -A4 -F 'label: Stamhoofd Development CA' | grep -q 'trust: anchor' && return 0
    fi

    return 1
}

setup_have_dev_certificates() {
    [ -f "$DEV_CA_CRT" ] \
        && [ -f "$DEV_CA_KEY" ] \
        && [ -f "$DEV_CERT_CRT" ] \
        && [ -f "$DEV_CERT_KEY" ]
}

setup_require_dev_certificates() {
    if ! setup_have_dev_certificates; then
        echo "Missing Stamhoofd development certificates. Run: just setup cert" >&2
        return 1
    fi
}

setup_generate_dev_certificates() {
    common_require_command openssl
    setup_prepare_cert_dir

    if setup_have_dev_certificates; then
        echo "Stamhoofd development certificates already exist in $CERT_DIR."
        if ! common_confirm "Generate new development certificates?"; then
            echo "Keeping existing development certificates."
            return 0
        fi

        common_command run rm -f "$DEV_CA_CRT" "$DEV_CA_KEY" "$DEV_CERT_CRT" "$DEV_CERT_KEY" "$DEV_CERT_CSR" "$DEV_CERT_EXT" "$DEV_CA_SERIAL"
    fi

    if [ ! -f "$DEV_CA_CRT" ] || [ ! -f "$DEV_CA_KEY" ]; then
        echo "Generating Stamhoofd development CA..."
        common_command_quiet run openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
            -keyout "$DEV_CA_KEY" \
            -out "$DEV_CA_CRT" \
            -subj "/CN=Stamhoofd Development CA" \
            -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
            -addext "keyUsage=critical,keyCertSign,cRLSign"
        common_command run chmod 600 "$DEV_CA_KEY"
    fi

    if [ ! -f "$DEV_CERT_CRT" ] || [ ! -f "$DEV_CERT_KEY" ]; then
        echo "Generating Stamhoofd development TLS certificate..."
        cat > "$DEV_CERT_EXT" <<EOF
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
DNS.1=${STAMHOOFD_DOMAIN}
DNS.2=*.${STAMHOOFD_DOMAIN}
DNS.3=dashboard.${STAMHOOFD_DOMAIN}
DNS.4=*.dashboard.${STAMHOOFD_DOMAIN}
DNS.5=api.${STAMHOOFD_DOMAIN}
DNS.6=*.api.${STAMHOOFD_DOMAIN}
DNS.7=renderer.${STAMHOOFD_DOMAIN}
DNS.8=*.renderer.${STAMHOOFD_DOMAIN}
DNS.9=registration.${STAMHOOFD_DOMAIN}
DNS.10=*.registration.${STAMHOOFD_DOMAIN}
DNS.11=shop.${STAMHOOFD_DOMAIN}
DNS.12=*.shop.${STAMHOOFD_DOMAIN}
DNS.13=sso.${STAMHOOFD_DOMAIN}
EOF

        common_command_quiet run openssl req -new -newkey rsa:2048 -nodes \
            -keyout "$DEV_CERT_KEY" \
            -out "$DEV_CERT_CSR" \
            -subj "/CN=*.${STAMHOOFD_DOMAIN}"
        common_command_quiet run openssl x509 -req -sha256 -days 825 \
            -in "$DEV_CERT_CSR" \
            -CA "$DEV_CA_CRT" \
            -CAkey "$DEV_CA_KEY" \
            -CAcreateserial \
            -out "$DEV_CERT_CRT" \
            -extfile "$DEV_CERT_EXT"
        common_command run chmod 600 "$DEV_CERT_KEY"
        common_command run rm -f "$DEV_CERT_CSR"
    fi
}

setup_resolved_config_content() {
    printf '[Resolve]\nDNS=%s\nDomains=~%s\n' "$LOCAL_HOST" "$STAMHOOFD_DOMAIN"
}

setup_write_resolved_config() {
    local mode="$1"
    local content
    content="$(setup_resolved_config_content)"

    common_command "$mode" sudo mkdir -p "$RESOLVED_RUNTIME_CONFIG_DIR"

    if [ "$mode" = "print" ]; then
        printf '  printf %%s %q | sudo tee %q >/dev/null\n' "$content" "$RESOLVED_RUNTIME_CONFIG"
    else
        printf '  printf %%s %q | sudo tee %q >/dev/null\n' "$content" "$RESOLVED_RUNTIME_CONFIG"
        printf '%s' "$content" | sudo tee "$RESOLVED_RUNTIME_CONFIG" >/dev/null
    fi

    common_command "$mode" sudo systemctl restart systemd-resolved
}

setup_dns() {
    dns_require_linux_resolved
    echo "This will configure temporary split DNS for .${STAMHOOFD_DOMAIN} only."
    echo "Existing DNS servers remain responsible for all other domains."
    echo "The config is written to /run and disappears on reboot."
    echo "systemd-resolved will be restarted."
    echo
    echo "Runtime config to write to ${RESOLVED_RUNTIME_CONFIG}:"
    echo "  [Resolve]"
    echo "  DNS=${LOCAL_HOST}"
    echo "  Domains=~${STAMHOOFD_DOMAIN}"
    echo
    echo "Commands to run:"
    dns_remove_networkmanager_entries print
    setup_write_resolved_config print
    echo
    if ! common_confirm "Apply this DNS configuration?"; then
        echo "DNS setup skipped."
        return 0
    fi

    dns_remove_networkmanager_entries run
    setup_write_resolved_config run

    if ! dns_check; then
        echo "DNS setup was written, but dashboard.${STAMHOOFD_DOMAIN} did not resolve to ${LOCAL_HOST}." >&2
        echo "Make sure 'just dev network' is running, then retry 'just setup dns'." >&2
        return 1
    fi

    echo "Temporary split DNS configured for .${STAMHOOFD_DOMAIN}."
}

setup_print_cert_instructions() {
    cat <<EOF
Manual Stamhoofd development certificate setup:

  just setup cert

This generates local certificate files in:

  ${CERT_DIR}

Manual trust commands on Linux for this machine:

EOF
    setup_install_cert print
    echo
    cat <<EOF
Afterwards, test whether the certificate is trusted. Restarting your browser might not be necessary, but try it if it does not work.

Firefox may need one extra step:
  - Set security.enterprise_roots.enabled=true in about:config, or
  - Import ${DEV_CA_CRT} manually in Firefox certificate settings.

Firefox on Fedora should not need a restart.

EOF
}

setup_install_cert_with_update_ca_certificates() {
    local mode="$1"

    common_command "$mode" sudo cp "$DEV_CA_CRT" "$TRUSTED_DEV_CA_CRT"
    common_command "$mode" sudo update-ca-certificates
}

setup_install_cert_with_trust() {
    local mode="$1"

    common_command "$mode" sudo trust anchor "$DEV_CA_CRT"
}

setup_install_cert() {
    local mode="$1"

    if [ "$(uname -s)" != "Linux" ]; then
        echo "  # Automatic certificate setup currently supports Linux only."
        [ "$mode" = "print" ] && return 0
        return 1
    fi

    if command -v update-ca-certificates >/dev/null 2>&1; then
        setup_install_cert_with_update_ca_certificates "$mode"
    elif command -v trust >/dev/null 2>&1; then
        setup_install_cert_with_trust "$mode"
    else
        echo "  # Could not find update-ca-certificates or trust. Depending on your distribution, run one of:"
        setup_install_cert_with_update_ca_certificates print
        setup_install_cert_with_trust print
        [ "$mode" = "print" ] && return 0
        return 1
    fi
}

setup_cert() {
    setup_generate_dev_certificates
    setup_print_cert_instructions
    if ! common_confirm "Trust the Stamhoofd development CA automatically?"; then
        echo "Automatic certificate setup skipped."
        return 0
    fi
    echo "Executing trust commands:"
    if ! setup_install_cert run; then
        echo "Automatic certificate setup failed. Use the manual instructions above." >&2
        return 1
    fi
    echo "The trust commands above were executed successfully."
}
