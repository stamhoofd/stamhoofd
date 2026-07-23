import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { caddyBaseImage, caddyBuilderImage, caddyImage } from '../../config/shared-service-config.js';
import type { CliContext } from '../../context/create-context.js';
import * as docker from '../docker.js';
import { CaddyService } from './caddy-service.js';

vi.mock('../docker.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../docker.js')>(),
    imageExists: vi.fn(),
    buildImage: vi.fn(),
}));

function context(generatedDir: string): CliContext {
    return { verbose: false, generatedDir } as unknown as CliContext;
}

describe('CaddyService.dockerfile', () => {
    it('compiles the replace_response plugin into a custom image via xcaddy', () => {
        const dockerfile = CaddyService.dockerfile();

        expect(dockerfile).toContain(`FROM ${caddyBuilderImage} AS builder`);
        expect(dockerfile).toContain('xcaddy build --with github.com/caddyserver/replace-response');
        expect(dockerfile).toContain(`FROM ${caddyBaseImage}`);
        expect(dockerfile).toContain('COPY --from=builder /usr/bin/caddy /usr/bin/caddy');
    });
});

describe('CaddyService.ensureImage', () => {
    let generatedDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stamhoofd-caddy-'));
    });

    afterEach(async () => {
        await fs.rm(generatedDir, { recursive: true, force: true });
    });

    it('builds the custom Caddy image with the plugin Dockerfile when it is missing', async () => {
        vi.mocked(docker.imageExists).mockResolvedValue(false);

        await CaddyService.ensureImage(context(generatedDir));

        expect(docker.buildImage).toHaveBeenCalledTimes(1);
        const [tag, buildDir, options] = vi.mocked(docker.buildImage).mock.calls[0];
        expect(tag).toBe(caddyImage);
        expect(buildDir).toContain('caddy-build');
        expect(options?.dockerfile).toBe(path.join(buildDir, 'Dockerfile'));

        const written = await fs.readFile(options!.dockerfile!, 'utf8');
        expect(written).toBe(CaddyService.dockerfile());
    });

    it('does not rebuild when the image already exists', async () => {
        vi.mocked(docker.imageExists).mockResolvedValue(true);

        await CaddyService.ensureImage(context(generatedDir));

        expect(docker.buildImage).not.toHaveBeenCalled();
    });
});
