import dotenv from "dotenv";

import { build } from '../helpers/build';
import { deploy } from '../helpers/deploy';

dotenv.config()

function shouldBuild(): boolean {
    for (const a of process.argv) {
        if (a == "--build") {
            return true
        }
    }
    return false
}

async function main() {
    if (shouldBuild()) {
        await build()
    }
    await deploy()
}

main()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err); process.exit(1);
    });