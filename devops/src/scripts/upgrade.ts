import dotenv from "dotenv";

import { getServer } from "../helpers/getServer";
import { upgradeCaddy } from '../install/install-caddy';

dotenv.config()

async function main() {
    // Get server first
    const server = await getServer()

    // Create users if needed
    await upgradeCaddy(server)
}

main()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err); process.exit(1);
    });