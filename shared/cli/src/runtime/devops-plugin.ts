import { Plugin } from '@oclif/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type DevopsSetupCheck = {
    label: string;
    check: () => Promise<{ ok: boolean; details: string; manualFix?: string }>;
};

export async function getOptionalDevopsSetupChecks(root: string): Promise<DevopsSetupCheck[]> {
    const modulePath = join(root, 'dist-cli/setup-checks.js');
    if (!existsSync(join(root, 'package.json')) || !existsSync(modulePath)) return [];
    // eslint-disable-next-line no-unsanitized/method -- Fixed entrypoint in the trusted local checkout, like the optional oclif plugin.
    const module = await import(pathToFileURL(modulePath).href) as { setupChecks: () => DevopsSetupCheck[] };
    return module.setupChecks();
}

export async function getOptionalDevopsPlugin(root: string): Promise<Plugin | undefined> {
    const commands = join(root, 'dist-cli/commands/devops');
    if (!existsSync(join(root, 'package.json')) || !existsSync(commands) || !readdirSync(commands).some(name => name.endsWith('.js'))) {
        return undefined;
    }

    const plugin = new Plugin({ root, type: 'core' });
    await plugin.load();
    return plugin;
}
