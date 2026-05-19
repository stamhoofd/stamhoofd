#!/usr/bin/env bash

sso_issuer() {
    printf '%s/realms/%s' "$SSO_BASE_URL" "$KEYCLOAK_REALM"
}

sso_validate_redirect_uri() {
    local redirect_uri="$1"
    if [ -z "$redirect_uri" ]; then
        echo "Missing redirect URI. Copy it from the SSO settings view and run:" >&2
        echo "  just sso start ${SSO_EXAMPLE_REDIRECT_URI}" >&2
        return 1
    fi

    case "$redirect_uri" in
        https://*/openid/callback) ;;
        *)
            echo "Invalid redirect URI: $redirect_uri" >&2
            echo "Expected an HTTPS /openid/callback URL copied from the SSO settings view." >&2
            return 1
            ;;
    esac
}

sso_keycloak_split_name() {
    local full_name="$1"
    local first_name last_name
    first_name="${full_name%% *}"
    if [ "$first_name" = "$full_name" ]; then
        last_name="User"
    else
        last_name="${full_name#* }"
    fi
    printf '%s\n%s\n' "$first_name" "$last_name"
}

sso_write_keycloak_realm() {
    local redirect_uri="$1"
    local first_name last_name split_name
    split_name="$(sso_keycloak_split_name "$KEYCLOAK_USER_NAME")"
    first_name="$(printf '%s' "$split_name" | sed -n '1p')"
    last_name="$(printf '%s' "$split_name" | sed -n '2p')"

    local realm_json client_id_json client_secret_json redirect_uri_json user_id_json user_email_json username_json first_name_json last_name_json password_json
    realm_json="$(common_json_string "$KEYCLOAK_REALM")"
    client_id_json="$(common_json_string "$KEYCLOAK_CLIENT_ID")"
    client_secret_json="$(common_json_string "$KEYCLOAK_CLIENT_SECRET")"
    redirect_uri_json="$(common_json_string "$redirect_uri")"
    user_id_json="$(common_json_string "$KEYCLOAK_USER_ID")"
    user_email_json="$(common_json_string "$KEYCLOAK_USER_EMAIL")"
    username_json="$(common_json_string "$KEYCLOAK_USER_EMAIL")"
    first_name_json="$(common_json_string "$first_name")"
    last_name_json="$(common_json_string "$last_name")"
    password_json="$(common_json_string "$KEYCLOAK_USER_PASSWORD")"

    common_prepare_dev_dirs
    mkdir -p "$KEYCLOAK_IMPORT_DIR"
    cat > "$KEYCLOAK_REALM_CONFIG" <<EOF
{
  "realm": ${realm_json},
  "enabled": true,
  "displayName": "Stamhoofd Local",
  "sslRequired": "external",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": false,
  "editUsernameAllowed": false,
  "bruteForceProtected": false,
  "defaultSignatureAlgorithm": "RS256",
  "clients": [
    {
      "clientId": ${client_id_json},
      "name": "Stamhoofd Local",
      "enabled": true,
      "protocol": "openid-connect",
      "secret": ${client_secret_json},
      "publicClient": false,
      "clientAuthenticatorType": "client-secret",
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "redirectUris": [${redirect_uri_json}],
      "webOrigins": ["+"],
      "defaultClientScopes": ["web-origins", "acr", "profile", "roles", "email"],
      "optionalClientScopes": ["address", "phone", "offline_access", "microprofile-jwt"],
      "attributes": {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris": "+"
      }
    }
  ],
  "users": [
    {
      "id": ${user_id_json},
      "username": ${username_json},
      "email": ${user_email_json},
      "firstName": ${first_name_json},
      "lastName": ${last_name_json},
      "enabled": true,
      "emailVerified": true,
      "realmRoles": ["offline_access"],
      "credentials": [
        {
          "type": "password",
          "value": ${password_json},
          "temporary": false
        }
      ]
    }
  ]
}
EOF
}

sso_config() {
    local redirect_uri="$1"
    local issuer
    issuer="$(sso_issuer)"

    cat <<EOF
Local SSO settings:

  Issuer:        ${issuer}
  Discovery:     ${issuer}/.well-known/openid-configuration
  Client ID:     ${KEYCLOAK_CLIENT_ID}
  Client secret: ${KEYCLOAK_CLIENT_SECRET}
  Redirect URI:  ${redirect_uri:-copy this from the SSO settings view}

Test user:

  Email:         ${KEYCLOAK_USER_EMAIL}
  Password:      ${KEYCLOAK_USER_PASSWORD}
  Name:          ${KEYCLOAK_USER_NAME}

Commands:

  just sso start "${redirect_uri:-${SSO_EXAMPLE_REDIRECT_URI}}"
  just sso start --background "${redirect_uri:-${SSO_EXAMPLE_REDIRECT_URI}}"
  just sso logs
  just sso stop

Note: use the Issuer value in the app. The Keycloak admin console is available at ${SSO_ADMIN_URL} with ${KEYCLOAK_ADMIN_USER}/${KEYCLOAK_ADMIN_PASSWORD}.
EOF
}

sso_run_keycloak() {
    local mode="$1"
    local docker_args=(
        --name "$KEYCLOAK_CONTAINER"
        -p "${LOCAL_HOST}:${SSO_PORT}:${KEYCLOAK_CONTAINER_PORT}"
        -e "KC_BOOTSTRAP_ADMIN_USERNAME=$KEYCLOAK_ADMIN_USER"
        -e "KC_BOOTSTRAP_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD"
        -e KC_HTTP_RELATIVE_PATH=/dex
        -v "$KEYCLOAK_IMPORT_DIR:/opt/keycloak/data/import:ro"
        "$KEYCLOAK_IMAGE"
        start-dev
        --import-realm
        --hostname="$SSO_BASE_URL"
        --proxy-headers=xforwarded
    )

    case "$mode" in
        background)
            common_command_quiet run docker run -d "${docker_args[@]}"
            ;;
        foreground)
            common_command run docker run --rm "${docker_args[@]}"
            ;;
        *)
            echo "Unknown Keycloak mode: $mode" >&2
            return 1
            ;;
    esac
}

sso_start() {
    local redirect_uri="$1"
    local background="${2:-false}"
    sso_validate_redirect_uri "$redirect_uri"
    common_require_command docker
    sso_write_keycloak_realm "$redirect_uri"

    dev_ensure_network_services

    echo "Starting Keycloak on ${LOCAL_HOST}:${SSO_PORT}..."
    common_docker_rm "$KEYCLOAK_CONTAINER"

    if [ "$background" = "true" ]; then
        sso_run_keycloak background

        echo "Local SSO server started in the background."
        echo
        sso_config "$redirect_uri"
        return 0
    fi

    sso_config "$redirect_uri"
    echo
    echo "Keycloak is running in the foreground. Press Ctrl+C to stop it."

    cleanup_done=0
    cleanup() {
        if [ "$cleanup_done" = "1" ]; then
            return
        fi
        cleanup_done=1
        trap - EXIT INT TERM
        common_docker_rm "$KEYCLOAK_CONTAINER"
        echo "Local SSO server stopped."
    }
    trap cleanup EXIT INT TERM

    sso_run_keycloak foreground
}

sso_stop() {
    common_docker_rm "$KEYCLOAK_CONTAINER"
    echo "Local SSO server stopped."
}

sso_logs() {
    exec docker logs -f "$KEYCLOAK_CONTAINER"
}
