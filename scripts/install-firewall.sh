#!/bin/bash
set -e

apt-get install ufw


# Temporary disable
ufw disable
ufw --force reset

# Default deny all
ufw default deny incoming
ufw default allow outgoing

# Allow ssh
ufw allow ssh
ufw allow 80
ufw allow 443

# Enable ufw
ufw --force enable