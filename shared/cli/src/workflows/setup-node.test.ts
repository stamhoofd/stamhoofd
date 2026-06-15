import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as commandRunner from '../runtime/command-runner.js';
import { checkNodeVersion, nodeInstallCommand, setupNodeVersion } from './setup-node.js';

describe('setup node workflow', () => {
    let tmpDir: string | undefined;

    afterEach(async () => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true, force: true });
            tmpDir = undefined;
        }
    });

    it('reports when the active Node.js version matches .nvmrc', async () => {
        tmpDir = await createProject(process.version);

        await expect(checkNodeVersion(tmpDir)).resolves.toEqual({
            ok: true,
            current: process.version,
            expected: process.version,
            details: `${process.version} matches .nvmrc`,
        });
    });

    it('reports the expected version when Node.js differs', async () => {
        tmpDir = await createProject('v99.1.2');

        await expect(checkNodeVersion(tmpDir)).resolves.toMatchObject({
            ok: false,
            current: process.version,
            expected: 'v99.1.2',
        });
    });

    it('runs the sourceable install script from the project root', async () => {
        tmpDir = await createProject('v99.1.2');
        const run = vi.spyOn(commandRunner, 'run').mockResolvedValue(undefined);
        const messages: string[] = [];
        vi.spyOn(console, 'log').mockImplementation(message => messages.push(String(message)));

        await setupNodeVersion(tmpDir, { verbose: true });

        expect(run).toHaveBeenCalledWith(
            'bash',
            ['-c', '. "$1"', 'stam-install-node', path.join(tmpDir, '.development/install-node.sh')],
            { cwd: tmpDir, verbose: true },
        );
        expect(nodeInstallCommand(tmpDir, tmpDir)).toBe('source ".development/install-node.sh"');
        expect(nodeInstallCommand(tmpDir, path.join(tmpDir, 'frontend/app'))).toBe('source "../../.development/install-node.sh"');
        expect(messages.join('\n')).toContain('ACTION REQUIRED: this terminal is still using the old Node.js version.');
        expect(messages.join('\n')).toContain('Restart your terminal before continuing, or activate the new version now:');
    });

    it('does not run the installer during a dry run', async () => {
        tmpDir = await createProject('v99.1.2');
        const run = vi.spyOn(commandRunner, 'run').mockResolvedValue(undefined);

        await setupNodeVersion(tmpDir, { verbose: false, dryRun: true });

        expect(run).not.toHaveBeenCalled();
    });
});

async function createProject(version: string): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-node-'));
    await fs.mkdir(path.join(directory, '.development'));
    await fs.writeFile(path.join(directory, '.nvmrc'), `${version}\n`);
    return directory;
}
