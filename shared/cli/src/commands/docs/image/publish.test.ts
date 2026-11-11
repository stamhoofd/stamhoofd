import { Parser } from '@oclif/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishDocsImage } from '../../../runtime/docs-image.js';
import { resolveDocsPublishingConfig } from '../../../runtime/docs-publishing.js';
import * as prompts from '../../../runtime/prompts.js';
import DocsImagePublish from './publish.js';

vi.mock('../../../runtime/docs-image.js', async importOriginal => ({ ...await importOriginal<typeof import('../../../runtime/docs-image.js')>(), publishDocsImage: vi.fn() }));
vi.mock('../../../runtime/docs-publishing.js', () => ({ resolveDocsPublishingConfig: vi.fn() }));
vi.mock('../../../runtime/prompts.js', async importOriginal => ({ ...await importOriginal<typeof import('../../../runtime/prompts.js')>(), confirm: vi.fn() }));

describe('docs image publish command', () => {
    const stdinTTY = process.stdin.isTTY;
    const stderrTTY = process.stderr.isTTY;
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => {
        process.stdin.isTTY = stdinTTY;
        process.stderr.isTTY = stderrTTY;
    });

    it.each([
        { argv: ['--latest'], expected: true },
        { argv: ['--no-latest'], expected: false },
        { argv: [], expected: undefined },
    ])('preserves the latest flag tri-state for $argv', async ({ argv, expected }) => {
        const parsed = await Parser.parse(['v1.2.3', ...argv], { flags: DocsImagePublish.flags, args: DocsImagePublish.args });
        expect(parsed.flags.latest).toBe(expected);
    });

    it.each([true, false])('does not prompt when latest is explicitly %s', async (latest) => {
        process.stdin.isTTY = false;
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: 'v1.2.3' }, flags: { latest }, context: { rootDir: '/repo' } });
        vi.mocked(resolveDocsPublishingConfig).mockResolvedValue({ registry: 'registry.example.com/team' });
        await command.run();
        expect(prompts.confirm).not.toHaveBeenCalled();
        expect(publishDocsImage).toHaveBeenCalledWith('/repo', 'v1.2.3', { registry: 'registry.example.com/team' }, undefined, latest);
    });

    it.each([true, false])('resolves the interactive latest choice (%s) before credentials or publication', async (latest) => {
        process.stdin.isTTY = true;
        process.stderr.isTTY = true;
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: 'v1.2.3' }, flags: {}, context: { rootDir: '/repo' } });
        vi.mocked(prompts.confirm).mockImplementationOnce(async () => {
            expect(resolveDocsPublishingConfig).not.toHaveBeenCalled();
            expect(publishDocsImage).not.toHaveBeenCalled();
            return latest;
        });
        vi.mocked(resolveDocsPublishingConfig).mockResolvedValue({ registry: 'registry.example.com/team' });
        await command.run();
        expect(prompts.confirm).toHaveBeenCalledWith({ message: "Point the 'latest' tag to this image as well?", default: false });
        expect(publishDocsImage).toHaveBeenCalledWith('/repo', 'v1.2.3', { registry: 'registry.example.com/team' }, undefined, latest);
    });

    it('requires an explicit latest choice noninteractively before reading credentials', async () => {
        process.stdin.isTTY = false;
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: 'v1.2.3' }, flags: {}, context: { rootDir: '/repo' } });
        await expect(command.run()).rejects.toThrow('Pass --latest or --no-latest');
        expect(prompts.confirm).not.toHaveBeenCalled();
        expect(resolveDocsPublishingConfig).not.toHaveBeenCalled();
        expect(publishDocsImage).not.toHaveBeenCalled();
    });

    it('passes resolved credentials to the isolated publishing lifecycle', async () => {
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: 'v1.2.3' }, flags: { environment: 'custom', latest: false }, context: { rootDir: '/repo' } });
        vi.mocked(resolveDocsPublishingConfig).mockResolvedValue({ registry: 'registry.example.com/team', credentials: { username: 'ci', password: 'secret' } });
        await command.run();
        expect(resolveDocsPublishingConfig).toHaveBeenCalledWith('/repo', 'custom');
        expect(publishDocsImage).toHaveBeenCalledWith('/repo', 'v1.2.3', { registry: 'registry.example.com/team', credentials: { username: 'ci', password: 'secret' } }, undefined, false);
    });

    it('rejects invalid tags before loading private configuration or credentials', async () => {
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: '../invalid' }, flags: {}, context: { rootDir: '/repo' } });
        await expect(command.run()).rejects.toThrow('Invalid image tag');
        expect(resolveDocsPublishingConfig).not.toHaveBeenCalled();
        expect(publishDocsImage).not.toHaveBeenCalled();
    });

    it('retains the explicit-registry external-login flow', async () => {
        const command = Object.create(DocsImagePublish.prototype) as DocsImagePublish;
        command.parseWithContext = vi.fn().mockResolvedValue({ args: { tag: 'v1.2.3' }, flags: { latest: false }, context: { rootDir: '/repo', verbosity: 1 } });
        vi.mocked(resolveDocsPublishingConfig).mockResolvedValue({ registry: 'registry.example.com/team' });
        await command.run();
        expect(publishDocsImage).toHaveBeenCalledWith('/repo', 'v1.2.3', { registry: 'registry.example.com/team' }, 1, false);
    });
});
