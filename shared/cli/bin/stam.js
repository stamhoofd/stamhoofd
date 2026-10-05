#!/usr/bin/env -S node --use-system-ca
import { Config, Errors, Plugin, run } from '@oclif/core';
import { fileURLToPath } from 'node:url';
import { getOptionalDevopsPlugin } from '../dist/runtime/devops-plugin.js';

const cliRoot = fileURLToPath(new URL('../', import.meta.url));
const devopsRoot = fileURLToPath(new URL('../../../devops/', import.meta.url));

async function loadConfig() {
    const devops = await getOptionalDevopsPlugin(devopsRoot);
    if (!devops) {
        return import.meta.url;
    }

    const root = new Plugin({ root: cliRoot, isRoot: true });
    await root.load();
    return Config.load({ root: cliRoot, plugins: new Map([[root.name, root], [devops.name, devops]]) });
}

async function main() {
    const args = process.argv.slice(2);

    const config = await loadConfig();

    if (args.length === 0) {
        await run(['--help'], config);
        return;
    }

    await run(args, config);
}

main().catch((error) => {
    if (error?.parse?.input?.argv) {
        error.showHelp = true;
    }
    return Errors.handle(error);
});
