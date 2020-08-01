set -e

# Download from Website with lego-deprecated
chmod +x caddy
mv caddy /usr/bin/

caddy version


sudo groupadd --system caddy
sudo useradd --system \
    --gid caddy \
    --create-home \
    --home-dir /var/lib/caddy \
    --shell /usr/sbin/nologin \
    --comment "Caddy web server" \
    caddy

# systemd service create

# add 
# [Service]
# Environment="DO_AUTH_TOKEN=XXXXX"

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl start caddy

systemctl status caddy