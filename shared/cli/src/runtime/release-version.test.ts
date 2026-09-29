import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from './command-runner.js';
import { bumpReleaseVersion, getReleaseVersion } from './release-version.js';

vi.mock('./command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('./command-runner.js')>(),
    run: vi.fn(),
}));

let cwd: string;

afterEach(async () => {
    vi.clearAllMocks();
    if (cwd) {
        await rm(cwd, { recursive: true, force: true });
    }
});

async function setup(versions: string[]): Promise<void> {
    cwd = await mkdtemp(join(tmpdir(), 'release-version-'));
    const packages = await Promise.all(versions.map(async (version, index) => {
        const path = join(cwd, `pkg-${index}`);
        await mkdir(path);
        await writeFile(join(path, 'package.json'), JSON.stringify({ name: `pkg-${index}`, version, private: index === 2 }, null, 4) + '\n');
        return { name: `pkg-${index}`, version, path, private: index === 2 };
    }));
    vi.mocked(run).mockResolvedValue({ stdout: JSON.stringify(packages), stderr: '', status: 0 } as never);
}

describe('fixed release version', () => {
    it('bumps all publishable packages together and leaves private packages unchanged', async () => {
        await setup(['2.153.0', '2.153.0', '1.0.0']);

        expect(await getReleaseVersion(cwd)).toBe('2.153.0');
        expect(await bumpReleaseVersion(cwd)).toEqual({ version: '2.153.1', paths: ['pkg-0/package.json', 'pkg-1/package.json'] });
        expect(JSON.parse(await readFile(join(cwd, 'pkg-0/package.json'), 'utf8')).version).toBe('2.153.1');
        expect(JSON.parse(await readFile(join(cwd, 'pkg-1/package.json'), 'utf8')).version).toBe('2.153.1');
        expect(JSON.parse(await readFile(join(cwd, 'pkg-2/package.json'), 'utf8')).version).toBe('1.0.0');
    });

    it('rejects mismatched publishable versions without changing files', async () => {
        await setup(['2.153.0', '2.152.0', '1.0.0']);

        await expect(bumpReleaseVersion(cwd)).rejects.toThrow('same version');
        expect(JSON.parse(await readFile(join(cwd, 'pkg-0/package.json'), 'utf8')).version).toBe('2.153.0');
    });
});
