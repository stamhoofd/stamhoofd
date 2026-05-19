#!/usr/bin/env bash

JUST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$JUST_DIR/common.sh"
source "$JUST_DIR/dns.sh"
source "$JUST_DIR/setup.sh"
source "$JUST_DIR/dev.sh"
source "$JUST_DIR/sso.sh"
source "$JUST_DIR/status.sh"
source "$JUST_DIR/db.sh"
source "$JUST_DIR/test.sh"
