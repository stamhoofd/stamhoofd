import { Plugin } from '@oclif/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export async function getOptionalDevopsPlugin(root: string): Promise<Plugin | undefined> {
    const commands = join(root, 'cli/commands/devops');
    if (!existsSync(join(root, 'package.json')) || !existsSync(commands) || !readdirSync(commands).some(name => name.endsWith('.js'))) {
        return undefined;
    }

    const plugin = new Plugin({ root, type: 'core' });
    await plugin.load();
    return plugin;
}
