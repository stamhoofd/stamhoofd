import dotenv from "dotenv";

import { getServer } from "../helpers/getServer";
import { initUsers } from '../install/init-users';
import { installCaddy } from '../install/install-caddy';
import { installMySQL } from '../install/install-mysql';
import { installNode, installPm2 } from '../install/install-node';
import { updateSoftware } from '../install/update-software';

dotenv.config()

async function main() {
    // Get server first
    const server = await getServer()

    // Create users if needed
    await initUsers(server);

    await updateSoftware(server);

    if (server.config.backend) {
        // We also need these dependencies
        await installNode(server)
        await installPm2(server)
        await installMySQL(server)
    }

    await installCaddy(server)
}

main()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err); process.exit(1);
    });