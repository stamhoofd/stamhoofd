import { promises as fs } from "fs"

import { Server } from '../classes/Server'

export async function installCaddy(server: Server): Promise<void> {
    if (!process.env.DO_AUTH_TOKEN) {
        throw new Error("Missing environment variable DO_AUTH_TOKEN")
    }
    console.log("Downloading caddy...")
    await server.execCommand("curl -L -o caddy 'https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com%2Fcaddy-dns%2Flego-deprecated&idempotency=73036686455444'")
    await server.execCommand("sudo mv caddy /usr/bin/")
    await server.execCommand("sudo chmod +x /usr/bin/caddy")
    await server.execCommand("caddy version")

    console.log("Adding caddy user...")
    await server.execCommand("sudo groupadd --system caddy")
    await server.execCommand("sudo useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin --comment \"Caddy web server\" caddy")

    console.log("Adding log folder...")
    await server.execCommand("sudo mkdir /var/log/caddy && sudo chown caddy:caddy /var/log/caddy")
    
    console.log("Installing service...");

    // Fill in environment variables...
    let serviceConfig = await fs.readFile(__dirname+"/../configs/caddy-api.service", "utf8");
    serviceConfig = serviceConfig.replace(/\$\{DO_AUTH_TOKEN\}/, process.env.DO_AUTH_TOKEN);
    await fs.writeFile(__dirname+"/.tmp.service", serviceConfig, "utf8");

    // Move file
    try {
        await (await server.getConnection()).putFile(__dirname+"/.tmp.service", `/home/${server.config.ssh.user}/caddy.service`)
        await server.execCommand(`sudo mv /home/${server.config.ssh.user}/caddy.service /etc/systemd/system/caddy.service && sudo systemctl daemon-reload && sudo systemctl enable caddy && sudo systemctl start caddy && systemctl status caddy`)
    } finally {
        await fs.unlink(__dirname+"/.tmp.service");
    }
}

export async function upgradeCaddy(server: Server): Promise<void> {
    if (!process.env.DO_AUTH_TOKEN) {
        throw new Error("Missing environment variable DO_AUTH_TOKEN")
    }
    console.log("Downloading caddy...")
    await server.execCommand("curl -L -o caddy 'https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com%2Fcaddy-dns%2Flego-deprecated'")

    console.log("Removing current caddy and replacing it with the new version")
    await server.execCommand("sudo rm /usr/bin/caddy")
    await server.execCommand("sudo mv caddy /usr/bin/")
    await server.execCommand("sudo chmod +x /usr/bin/caddy")

    const v = server.verbose
    server.verbose = true

    await server.execCommand("caddy version")

    console.log("Restarting service...");
    
    await server.execCommand(`sudo systemctl restart caddy && systemctl status caddy`)
    server.verbose = v
}