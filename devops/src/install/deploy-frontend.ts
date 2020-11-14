import { exec } from "child_process"
import util from "util"

import { Server } from '../classes/Server';
const execPromise = util.promisify(exec);

/**
 * Deploy any compiled frontend to the server
 * @param server Server to use
 * @param app Name of the frontend app to deploy (webshop, registration, dashboard)
 */
export async function deployFrontend(server: Server, app: string): Promise<void> {
    await server.execCommand(`sudo mkdir -p /var/www/stamhoofd && sudo chown ${server.config.ssh.user}:${server.config.ssh.user} /var/www/stamhoofd`);
    
    const folder = `${__dirname}/../../../frontend/app/${app}/dist/`;

    // Move the compiled files to the server, keeping the old ones
    const cmd = `rsync -a -e "ssh -T -p 22 -o Compression=no -o StrictHostKeyChecking=accept-new -x" --delay-updates --info=progress2 --no-owner --no-group --no-perms -W ${folder} ${server.config.ssh.user}@${server.config.ssh.ip}:/var/www/stamhoofd/${app}`
    await execPromise(cmd);
}