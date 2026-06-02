import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CliContext } from '../context/create-context.js';
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
