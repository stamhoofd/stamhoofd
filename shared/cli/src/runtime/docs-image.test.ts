import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../services/docker.js';
import { RunVerbosity } from './command-runner.js';
import { buildDocsImage, docsImageReference, publishDocsImage } from './docs-image.js';

vi.mock('../services/docker.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/docker.js')>()),
    run: vi.fn(),
}));

describe('documentation images', () => {
    let rootDir: string;

    beforeEach(() => vi.clearAllMocks());

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-docs-image-'));
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it('builds an amd64 image using the current .nvmrc without registry credentials or DevOps', async () => {
        for (const version of ['22.1.0', '24.2.0', 'v24.2.0']) {
            await fs.writeFile(path.join(rootDir, '.nvmrc'), `${version}\n`);
            await buildDocsImage(rootDir, 'v1.2.3');
            expect(run).toHaveBeenLastCalledWith(
                [
                    'build',
                    '--platform',
                    'linux/amd64',
                    '--file',
                    'docs/Dockerfile',
                    '--build-arg',
                    `NODE_VERSION=${version.replace(/^v/, '')}`,
                    '--tag',
                    'docs:v1.2.3',
                    '.',
                ],
                { cwd: rootDir, verbosity: RunVerbosity.Output },
            );
        }
    });

    it('pushes only the explicit version and does not build or deploy', async () => {
        await publishDocsImage(
            '/repo',
            'v1.2.3',
            { registry: 'registry.example.com/team' },
            RunVerbosity.Output,
            false,
        );
        expect(run).toHaveBeenNthCalledWith(
            1,
            ['tag', 'docs:v1.2.3', 'registry.example.com/team/docs:v1.2.3'],
            { cwd: '/repo', verbosity: RunVerbosity.Output },
        );
        expect(run).toHaveBeenNthCalledWith(2, ['push', 'registry.example.com/team/docs:v1.2.3'], {
            cwd: '/repo',
            verbosity: RunVerbosity.Output,
        });
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('pushes the requested version before latest, both from the same local image', async () => {
        await publishDocsImage(
            '/repo',
            'v1.2.3',
            { registry: 'host/team' },
            RunVerbosity.Output,
            true,
        );
        expect(vi.mocked(run).mock.calls.map(([args]) => args)).toEqual([
            ['tag', 'docs:v1.2.3', 'host/team/docs:v1.2.3'],
            ['push', 'host/team/docs:v1.2.3'],
            ['tag', 'docs:v1.2.3', 'host/team/docs:latest'],
            ['push', 'host/team/docs:latest'],
        ]);
    });

    it.each([true, false])(
        'pushes a requested latest tag only once (latest=%s)',
        async (latest) => {
            await publishDocsImage(
                '/repo',
                'latest',
                { registry: 'host/team' },
                RunVerbosity.Output,
                latest,
            );
            expect(vi.mocked(run).mock.calls.map(([args]) => args)).toEqual([
                ['tag', 'docs:latest', 'host/team/docs:latest'],
                ['push', 'host/team/docs:latest'],
            ]);
        },
    );

    it('fails before tagging if no destination is configured', async () => {
        await expect(publishDocsImage('/repo', 'v1.2.3', { registry: '' })).rejects.toThrow(
            'STAM_DOCS_REGISTRY',
        );
        expect(run).not.toHaveBeenCalled();
    });

    it.each(['', '-bad', 'a/b', 'a:tag', 'a;echo secret', 'a'.repeat(129)])(
        'rejects invalid tag %s',
        (tag) => {
            expect(() => docsImageReference(tag)).toThrow('Invalid image tag');
        },
    );

    it.each([
        'https://registry.example.com/team',
        'registry.example.com/team/',
        '',
        '--evil',
        'host/namespace:tag',
    ])('rejects malformed registry %s', (registry) => {
        expect(() => docsImageReference('v1.2.3', registry)).toThrow('STAM_DOCS_REGISTRY');
    });

    it('stops on push failure', async () => {
        vi.mocked(run).mockResolvedValueOnce().mockRejectedValueOnce(new Error('denied'));
        await expect(
            publishDocsImage(
                '/repo',
                'v1.2.3',
                { registry: 'host/private' },
                RunVerbosity.Output,
                true,
            ),
        ).rejects.toThrow('denied');
        expect(run).toHaveBeenCalledTimes(2);
    });
});
