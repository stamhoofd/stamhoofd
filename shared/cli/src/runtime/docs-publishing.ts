import path from 'node:path';
import { getOptionalDocsPublishingProvider } from './devops-plugin.js';
import { docsImageReference } from './docs-image.js';

export type DocsPublishingConfig = {
    registry: string;
    credentials?: { username: string; password: string };
};

/** Publication targets shared artifacts, not an environment. Discovery is retained for old completion scripts. */
export type DocsPublishingProvider = {
    listEnvironments: () => Promise<{ value: string; name: string }[]>;
    resolve: (environment?: string) => Promise<DocsPublishingConfig>;
};

/** Explicit registry configuration never loads the optional private provider. */
export async function resolveDocsPublishingConfig(
    rootDir: string,
    _environment?: string,
    env = process.env,
): Promise<DocsPublishingConfig> {
    const username = env.STAM_DOCS_REGISTRY_USERNAME;
    const password = env.STAM_DOCS_REGISTRY_PASSWORD;
    if ((username !== undefined || password !== undefined) && (!username || !password)) {
        throw new Error(
            'Set both STAM_DOCS_REGISTRY_USERNAME and STAM_DOCS_REGISTRY_PASSWORD to nonempty values.',
        );
    }
    let config: DocsPublishingConfig;
    if (env.STAM_DOCS_REGISTRY !== undefined) {
        config = { registry: env.STAM_DOCS_REGISTRY };
    } else {
        const provider = await getOptionalDocsPublishingProvider(path.join(rootDir, 'devops'));
        if (!provider)
            throw new Error(
                'Set STAM_DOCS_REGISTRY to the destination registry host/namespace, or install and build the optional DevOps checkout to discover shared artifacts.',
            );
        config = await provider.resolve();
    }
    docsImageReference('config-validation', config.registry);
    return { ...config, ...(username && password ? { credentials: { username, password } } : {}) };
}
