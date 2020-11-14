import { promises as fs } from "fs"

import { Server } from '../classes/Server'
import { buildCaddyConfig } from '../helpers/buildCaddyConfig';

export async function updateCaddyConfig(server: Server): Promise<void> {
    // Fill in environment variables...
    const config = buildCaddyConfig(server)
    await fs.writeFile(__dirname+"/.caddy.tmp.json", config, "utf8");

    // Move file
    try {
        console.log("Setting caddy config..")
        await (await server.getConnection()).putFile(__dirname+"/.caddy.tmp.json", `/home/${server.config.ssh.user}/caddy.api.json`)
        await server.execCommand("curl localhost:2019/load -X POST -H \"Content-Type: application/json\" -d @caddy.api.json", { cwd:`/home/${server.config.ssh.user}`} )
    } finally {
        await fs.unlink(__dirname+"/.caddy.tmp.json");
    }
}