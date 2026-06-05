import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { caddyAdminPort, localhostPort } from './shared-service-config.js';
import { writeCaddyConfig } from './caddy-config.js';

describe('Caddy config', () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stamhoofd-cli-caddy-'));
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it('writes bind-mounted config files readable by rootless containers', async () => {
        const config = await writeCaddyConfig(context(rootDir));

        expect((await fs.stat(path.dirname(config))).mode & 0o777).toBe(0o755);
        expect((await fs.stat(config)).mode & 0o777).toBe(0o644);
    });

    it('binds the admin API to localhost by default', async () => {
        const config = await writeCaddyConfig(context(rootDir));
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));

        expect(caddyConfig.admin.listen).toBe(localhostPort(caddyAdminPort));
        expect(caddyConfig.admin.origins).toEqual([`http://${localhostPort(caddyAdminPort)}`]);
    });

    it('can bind the admin API to the container interface', async () => {
        const config = await writeCaddyConfig(context(rootDir), { adminListenHost: '0.0.0.0' });
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));

        expect(caddyConfig.admin.listen).toBe(`0.0.0.0:${caddyAdminPort}`);
        expect(caddyConfig.admin.origins).toEqual([`http://${localhostPort(caddyAdminPort)}`]);
    });
});

function context(rootDir: string): CliContext {
    return {
        rootDir,
        generatedDir: path.join(rootDir, 'generated'),
        env: 'stamhoofd',
        workspace: 'test',
        verbose: false,
        instance: {
            name: 'test',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
