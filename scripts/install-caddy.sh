set -e

# install go

# install xcaddy
go get -u github.com/caddyserver/xcaddy/cmd/xcaddy

# install caddy with plugins
xcaddy build --with github.com/caddy-dns/lego-deprecated

# Move caddy to a folder (macos for now)
# macos: /usr/local/bin/
mv caddy /usr/local/bin/caddy

# todo: install to systemd

# Build caddy for server
# docs: https://golang.org/doc/install/source#environment
#GOOS=linux GOARCH=arm GOARM=6 xcaddy build --with github.com/caddy-dns/lego-deprecated