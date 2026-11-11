#!/usr/bin/env -S node --use-system-ca
import { Config, Errors, run } from '@oclif/core';
import { fileURLToPath } from 'node:url';
import { getOptionalDevopsPlugin } from '../dist/runtime/devops-plugin.js';

const cliRoot = fileURLToPath(new URL('../', import.meta.url));
const devopsRoot = fileURLToPath(new URL('../../../devops/', import.meta.url));

async function loadConfig() {
    const config = await Config.load({ root: cliRoot });
    const devops = await getOptionalDevopsPlugin(devopsRoot);
    if (!devops) {
        return config;
    }

    return Config.load({ root: cliRoot, plugins: new Map([...config.plugins, [devops.name, devops]]) });
}

async function main() {
    const args = process.argv.slice(2);

    const config = await loadConfig();

    // Shortcut setup owns completion installation. Hide helpers in metadata so help and completion agree, while direct invocation remains available.
    const isCompletionHelper = id => ['autocomplete', 'completion'].includes(id.split(':')[0]);
    for (const command of [...config.commands, ...config.getPluginsList().flatMap(plugin => plugin.commands)]) {
        if (isCompletionHelper(command.id)) command.hidden = true;
    }
    for (const topic of config.topics) {
        if (isCompletionHelper(topic.name)) topic.hidden = true;
    }

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
