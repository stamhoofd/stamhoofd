import { Plugin } from '@oclif/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DocsPublishingProvider } from './docs-publishing.js';

/** Missing builds are optional; failures in an installed provider are not hidden. */
export async function getOptionalDocsPublishingProvider(
    root: string,
): Promise<DocsPublishingProvider | undefined> {
    const modulePath = join(root, 'dist-cli/docs-publishing.js');
    if (!existsSync(join(root, 'package.json')) || !existsSync(modulePath)) return undefined;
    // eslint-disable-next-line no-unsanitized/method -- Fixed entrypoint in the trusted local checkout, like the optional oclif plugin.
    const module = (await import(pathToFileURL(modulePath).href)) as {
        docsPublishingProvider: DocsPublishingProvider;
    };
    if (
        typeof module.docsPublishingProvider?.resolve !== 'function' ||
        typeof module.docsPublishingProvider?.listEnvironments !== 'function'
    ) {
        throw new Error(
            'Invalid DevOps docs publishing provider. Rebuild the optional DevOps checkout.',
        );
    }
    return module.docsPublishingProvider;
}

export type DevopsSetupCheck = {
    label: string;
    check: () => Promise<{ ok: boolean; details: string; manualFix?: string }>;
};

export async function getOptionalDevopsSetupChecks(root: string): Promise<DevopsSetupCheck[]> {
    const modulePath = join(root, 'dist-cli/setup-checks.js');
    if (!existsSync(join(root, 'package.json')) || !existsSync(modulePath)) return [];
    // eslint-disable-next-line no-unsanitized/method -- Fixed entrypoint in the trusted local checkout, like the optional oclif plugin.
    const module = (await import(pathToFileURL(modulePath).href)) as {
        setupChecks: () => DevopsSetupCheck[];
    };
    return module.setupChecks();
}

export async function getOptionalDevopsPlugin(root: string): Promise<Plugin | undefined> {
    const commands = join(root, 'dist-cli/commands/devops');
    if (
        !existsSync(join(root, 'package.json')) ||
        !existsSync(commands) ||
        !readdirSync(commands).some((name) => name.endsWith('.js'))
    ) {
        return undefined;
    }

    const plugin = new Plugin({ root, type: 'core' });
    await plugin.load();
    return plugin;
}
