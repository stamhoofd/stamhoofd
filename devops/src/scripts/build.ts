import dotenv from "dotenv";

import { build } from '../helpers/build';

dotenv.config()

async function main() {
    await build()
}

main()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err); process.exit(1);
    });