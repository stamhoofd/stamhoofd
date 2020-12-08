import { deployBackend } from '../install/deploy-backend';
import { deployFrontend } from '../install/deploy-frontend';
import { updateCaddyConfig } from '../install/update-caddy-config';
import { getApp } from './getApp';
import { getServer } from "./getServer";

export async function deploy() {
    // Get server first
    const server = await getServer()
    const preferred = getApp()

    if (server.config.backend) {
        if (!preferred || preferred == "backend") {
            await deployBackend(server)
        }
    }

    if (server.config.frontend) {
        const apps = server.config.frontend.apps

        for (const app of apps) {
            if (preferred && app != preferred) {
                console.log(`Skipped ${app}.`)
                continue;
            }
            console.log(`Deploying ${app}...`)
            await deployFrontend(server, app)
        }
    }

    // Update caddy configs (only do this after deployment!)
    await updateCaddyConfig(server)
}