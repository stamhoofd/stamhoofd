import { exec } from "child_process"
import { promises as fs } from "fs"
import util from "util"

import { Server } from '../classes/Server';
import { buildBackendEnv } from '../helpers/buildBackendEnv';
const execPromise = util.promisify(exec);

export async function deployBackend(server: Server): Promise<void> {
    await server.execCommand("sudo mkdir -p /etc/stamhoofd && sudo chown stamhoofd:stamhoofd /etc/stamhoofd");
    
    const folder = `${__dirname}/../../../`;

    // Move files
    const cmd = `rsync -a -e "ssh -T -p 22 -o Compression=no -o StrictHostKeyChecking=accept-new -x" --delete --info=progress2 --filter="+ backend/dist" --filter="+ shared/*/dist" --filter="+ shared/*/esm/dist" --filter=":- .gitignore" --exclude ".git" --exclude "frontend/" --exclude "devops/" --no-owner --no-group --no-perms -W ${folder} ${server.config.ssh.user}@${server.config.ssh.ip}:/etc/stamhoofd
`
    
    const { stdout, stderr } = await execPromise(cmd);
    console.log(stdout);
    console.error(stderr);

    console.log("Installing node dependencies...")
    await server.execCommand("yarn install --production", { cwd:'/etc/stamhoofd/'} );

    console.log("Stopping current backend...")

    // Stop, ignore response because stopping might fail if not already started (do not use execCommand as this checks exit status)
    try {
        await server.execCommand("pm2 stop all && pm2 delete all", { cwd:'/etc/stamhoofd/backend'} );
    } catch (e) {
        // ignore
    }

    console.log("Setting env file...")

    // Setup env
    const env = buildBackendEnv(server)

    await fs.writeFile(__dirname+"/.env", env, "utf8")

    try {
        await (await server.getConnection()).putFile(__dirname+"/.env", "/etc/stamhoofd/backend/.env")
    } finally {
        await fs.unlink(__dirname+"/.env")
    }

    console.log("Deleting test files...")
    await server.execCommand("rm src/**/*.test.ts", { cwd:'/etc/stamhoofd/backend'} );
    await server.execCommand("rm shared/*/src/*.test.ts", { cwd:'/etc/stamhoofd'} );

    console.log("Running migrations...")

    // Run migrations
    await server.execCommand("node ./dist/migrations.js", { cwd:'/etc/stamhoofd/backend'} );

    console.log("Starting server...")
    // 
    await server.execCommand( "pm2 start dist/index.js --time --name stamhoofd", { cwd:'/etc/stamhoofd/backend'} );

    console.log("Saving config...")
    await server.execCommand("pm2 save", { cwd:'/etc/stamhoofd/backend'} );
}
