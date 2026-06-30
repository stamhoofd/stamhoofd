#!/usr/bin/env -S node --use-system-ca
import { run } from '@oclif/core';

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        await run(['--help'], import.meta.url);
        return;
    }

    await run(args, import.meta.url);
}

main().catch((error) => {
    const exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
    console.error(error);
    process.exitCode = exitCode;
});
