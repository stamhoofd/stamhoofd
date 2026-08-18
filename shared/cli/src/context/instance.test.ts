import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { buildInstance } from './instance.js';
import { buildPorts } from './ports.js';
import { slug } from './workspace.js';
import type { CliContext } from './create-context.js';
import { resolvePortOffset } from './port-allocation.js';

const freeTestPortOffset = 10000;
const execFileAsync = promisify(execFile);

describe('slug', () => {
    it('normalizes values for domains and container names', () => {
        expect(slug('Feature/Payments Test')).toBe('feature-payments-test');
        expect(slug('---Main---')).toBe('main');
    });
});

describe('buildInstance', () => {
    it('keeps the default Stamhoofd main instance on base ports', () => {
        const instance = buildInstance({ env: 'stamhoofd', workspace: 'main', primary: true });

        expect(instance).toEqual({
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        });
    });

    it('adds workspace isolation for secondary instances', () => {
        const instance = buildInstance({ env: 'keeo', workspace: 'Andreas Repo', primary: false });

        expect(instance.name).toBe('stamhoofd-andreas-repo-keeo');
        expect(instance.prefix).toBe('andreas-repo');
        expect(instance.primary).toBe(false);
        expect(instance.portOffset).toBeGreaterThanOrEqual(100);
    });

    it('allows explicit name and port overrides', () => {
        vi.stubEnv('STAMHOOFD_PORT_OFFSET', '4200');
        const instance = buildInstance({ env: 'stamhoofd', workspace: 'main', primary: true, overrideName: 'Custom Name' });

        expect(instance.name).toBe('custom-name');
        expect(instance.portOffset).toBe(4200);
        vi.unstubAllEnvs();
    });
});

describe('resolvePortOffset', () => {
    it('keeps the existing offset when the ports are free', async () => {
        const context = testContext(freeTestPortOffset);

        await expect(resolvePortOffset(context)).resolves.toMatchObject({
            instance: expect.objectContaining({ portOffset: freeTestPortOffset }),
        });
    });

    it('moves to the next port bucket when the current ports are occupied', async () => {
        const context = testContext(freeTestPortOffset);
        const occupied = await occupyPort(buildPorts(context).webApp);

        await expect(resolvePortOffset(context)).resolves.toMatchObject({
            instance: expect.objectContaining({ portOffset: freeTestPortOffset + 100 }),
        });

        await occupied.close();
    });

    it('fails for explicit offsets that are already occupied', async () => {
        const context = testContext(freeTestPortOffset);
        const occupied = await occupyPort(buildPorts(context).webApp);
        vi.stubEnv('STAMHOOFD_PORT_OFFSET', String(freeTestPortOffset));

        await expect(resolvePortOffset(context)).rejects.toThrow(new RegExp(`Configured port offset ${freeTestPortOffset} is unavailable`));

        vi.unstubAllEnvs();
        await occupied.close();
    });

    it('skips validation for inherited locked offsets', async () => {
        const context = testContext(freeTestPortOffset);
        const occupied = await occupyPort(buildPorts(context).dashboard);
        vi.stubEnv('STAMHOOFD_PORT_OFFSET', String(freeTestPortOffset));
        vi.stubEnv('STAMHOOFD_PORT_OFFSET_LOCKED', '1');

        await expect(resolvePortOffset(context)).resolves.toMatchObject({
            instance: expect.objectContaining({ portOffset: freeTestPortOffset }),
        });

        vi.unstubAllEnvs();
        await occupied.close();
    });

    it.skipIf(process.platform !== 'darwin')('reports an actual OS-level bind denial separately from occupied ports', async () => {
        const context = testContext(freeTestPortOffset);
        const moduleUrl = new URL('../../dist/context/port-allocation.js', import.meta.url).href;
        const script = `
            const { resolvePortOffset } = await import(process.argv[1]);
            try {
                await resolvePortOffset(JSON.parse(process.argv[2]));
                process.exitCode = 1;
            } catch (error) {
                console.log(error instanceof Error ? error.message : String(error));
            }
        `;
        const { stdout } = await execFileAsync('/usr/bin/sandbox-exec', [
            '-p',
            '(version 1) (allow default) (deny network-bind)',
            process.execPath,
            '--input-type=module',
            '--eval',
            script,
            moduleUrl,
            JSON.stringify(context),
        ]);

        expect(stdout).toMatch(/permission to open development ports/i);
        expect(stdout).not.toMatch(/free development port range/i);
    });
});

function testContext(portOffset: number): CliContext {
    return {
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset,
        },
    };
}

async function occupyPort(port: number): Promise<{ close: () => Promise<void> }> {
    const net = await import('node:net');
    const server = net.createServer();

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
    });

    return {
        close: async () => await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        }),
    };
}
