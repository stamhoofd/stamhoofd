import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOptionalDocsPublishingProvider } from './devops-plugin.js';
import { resolveDocsPublishingConfig } from './docs-publishing.js';

vi.mock('./devops-plugin.js', () => ({ getOptionalDocsPublishingProvider: vi.fn() }));

describe('docs publishing configuration', () => {
    beforeEach(() => vi.resetAllMocks());

    it('uses an explicit registry and CI credentials without loading private code', async () => {
        expect(await resolveDocsPublishingConfig('/repo', 'custom', {
            STAM_DOCS_REGISTRY: 'registry.example.com/team',
            STAM_DOCS_REGISTRY_USERNAME: 'ci', STAM_DOCS_REGISTRY_PASSWORD: 'secret',
        })).toEqual({ registry: 'registry.example.com/team', credentials: { username: 'ci', password: 'secret' } });
        expect(getOptionalDocsPublishingProvider).not.toHaveBeenCalled();
    });

    it('supports the existing external-login configuration', async () => {
        expect(await resolveDocsPublishingConfig('/repo', undefined, { STAM_DOCS_REGISTRY: 'registry.example.com/team' }))
            .toEqual({ registry: 'registry.example.com/team' });
    });

    it.each([
        { STAM_DOCS_REGISTRY_USERNAME: 'ci' },
        { STAM_DOCS_REGISTRY_PASSWORD: 'secret' },
        { STAM_DOCS_REGISTRY_USERNAME: '', STAM_DOCS_REGISTRY_PASSWORD: 'secret' },
    ])('rejects incomplete credentials before loading a provider', async (env) => {
        await expect(resolveDocsPublishingConfig('/repo', undefined, env)).rejects.toThrow('Set both');
        expect(getOptionalDocsPublishingProvider).not.toHaveBeenCalled();
    });

    it('reports actionable configuration when the provider is absent', async () => {
        await expect(resolveDocsPublishingConfig('/repo', undefined, {})).rejects.toThrow('install and build the optional DevOps checkout');
    });

    it('passes explicit custom environments to the private resolver', async () => {
        const config = { registry: 'registry.example.com/team', credentials: { username: 'publisher', password: 'secret' } };
        const resolve = vi.fn().mockResolvedValue(config);
        vi.mocked(getOptionalDocsPublishingProvider).mockResolvedValue({ resolve, listEnvironments: vi.fn() });
        expect(await resolveDocsPublishingConfig('/repo', 'custom', {})).toEqual(config);
        expect(getOptionalDocsPublishingProvider).toHaveBeenCalledWith('/repo/devops');
        expect(resolve).toHaveBeenCalledWith('custom');
    });

    it('uses a supplied credential pair with the provider destination when no registry is set', async () => {
        vi.mocked(getOptionalDocsPublishingProvider).mockResolvedValue({
            listEnvironments: vi.fn(),
            resolve: vi.fn().mockResolvedValue({ registry: 'registry.example.com/team', credentials: { username: 'provider', password: 'provider-password' } }),
        });
        expect(await resolveDocsPublishingConfig('/repo', 'custom', {
            STAM_DOCS_REGISTRY_USERNAME: 'ci', STAM_DOCS_REGISTRY_PASSWORD: 'ci-password',
        })).toEqual({ registry: 'registry.example.com/team', credentials: { username: 'ci', password: 'ci-password' } });
    });

    it('propagates installed provider failures', async () => {
        vi.mocked(getOptionalDocsPublishingProvider).mockRejectedValue(new Error('broken provider'));
        await expect(resolveDocsPublishingConfig('/repo', undefined, {})).rejects.toThrow('broken provider');
        vi.mocked(getOptionalDocsPublishingProvider).mockResolvedValue({ resolve: vi.fn().mockRejectedValue(new Error('vault denied')), listEnvironments: vi.fn() });
        await expect(resolveDocsPublishingConfig('/repo', undefined, {})).rejects.toThrow('vault denied');
    });

    it('rejects an invalid explicit registry without falling back to private code', async () => {
        await expect(resolveDocsPublishingConfig('/repo', undefined, { STAM_DOCS_REGISTRY: '' })).rejects.toThrow('STAM_DOCS_REGISTRY');
        expect(getOptionalDocsPublishingProvider).not.toHaveBeenCalled();
    });
});
