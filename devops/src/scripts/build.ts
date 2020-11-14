import { exec } from "child_process"
import dotenv from "dotenv";
import util from "util"

import { buildFrontendEnv } from '../helpers/buildFrontendEnv';
import { getApp } from '../helpers/getApp';
import { getServer } from "../helpers/getServer";
const execPromise = util.promisify(exec);

dotenv.config()

async function main() {
    // Get server first
    const server = await getServer()
    const preferred = getApp()

    console.log(`Building shared...`)
    await execPromise("yarn build", { cwd: `${__dirname}/../../..`})

    if (server.config.backend) {
        if (!preferred || preferred == "backend") {
            console.log(`Building backend...`)
            await execPromise("yarn build:full", { cwd: `${__dirname}/../../../backend`})
        }
    }

    if (server.config.frontend) {
        const apps = server.config.frontend.apps
        const frontendEnv = buildFrontendEnv(server)

        for (const app of apps) {
            if (preferred && app != preferred) {
                console.log(`Skipped ${app}.`)
                continue;
            }
            console.log(`Building ${app}...`)
            await execPromise("yarn build:production", { env: { ...process.env, LOAD_ENV: frontendEnv }, cwd: `${__dirname}/../../../frontend/app/${app}`})
        }
    }
}

main()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err); process.exit(1);
    });