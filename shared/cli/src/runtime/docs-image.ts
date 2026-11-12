import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ContainerRuntime, getContainerRuntime, run } from '../services/docker.js';
import { RunVerbosity } from './command-runner.js';
import type { DocsPublishingConfig } from './docs-publishing.js';
import { exec } from './process.js';
import { withCliCleanup } from './telemetry.js';

/** A single image reference is used for both local builds and registry publication. */
export function docsImageReference(tag: string, registry?: string): string {
    if (!/^\w[\w.-]{0,127}$/.test(tag)) {
        throw new Error('Invalid image tag. Use a version such as v1.2.3.');
    }
    if (
        registry !== undefined &&
        !/^[a-z0-9.-]+(?::\d+)?\/[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(registry)
    ) {
        throw new Error(
            'STAM_DOCS_REGISTRY must be a registry host/namespace without a scheme or trailing slash.',
        );
    }
    return `${registry ? `${registry}/` : ''}docs:${tag}`;
}

export async function buildDocsImage(
    rootDir: string,
    tag: string,
    verbosity = RunVerbosity.Output,
): Promise<void> {
    const nodeVersion = (await fs.readFile(path.join(rootDir, '.nvmrc'), 'utf8'))
        .trim()
        .replace(/^v/, '');
    await run(
        [
            'build',
            '--platform',
            'linux/amd64',
            '--file',
            'docs/Dockerfile',
            '--build-arg',
            `NODE_VERSION=${nodeVersion}`,
            '--tag',
            docsImageReference(tag),
            '.',
        ],
        { cwd: rootDir, verbosity },
    );
}

/** Push the requested tag before optional latest; supplied credentials live only in invocation-owned files. */
export async function publishDocsImage(
    rootDir: string,
    tag: string,
    config: DocsPublishingConfig,
    verbosity = RunVerbosity.Output,
    latest = false,
): Promise<void> {
    const { registry, credentials } = config;
    if (!registry)
        throw new Error('Set STAM_DOCS_REGISTRY to the destination registry host/namespace.');
    const local = docsImageReference(tag);
    const remote = docsImageReference(tag, registry);
    const references = [
        remote,
        ...(latest && tag !== 'latest' ? [docsImageReference('latest', registry)] : []),
    ];
    if (credentials) {
        const runtime = await getContainerRuntime();
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-docs-auth-'));
        try {
            await fs.chmod(directory, 0o700);
            const host = registry.split('/')[0];
            const authFile = path.join(directory, 'config.json');
            const env: NodeJS.ProcessEnv = {
                ...process.env,
                DOCKER_CONFIG: directory,
                REGISTRY_AUTH_FILE: authFile,
            };
            delete env.STAM_DOCS_REGISTRY_USERNAME;
            delete env.STAM_DOCS_REGISTRY_PASSWORD;
            delete env.DOCKER_AUTH_CONFIG;
            const { username, password } = credentials;
            const options = {
                cwd: rootDir,
                env,
                redact: [
                    username,
                    password,
                    Buffer.from(`${username}:${password}`).toString('base64'),
                ],
                output:
                    verbosity === RunVerbosity.Output ? ('always' as const) : ('verbose' as const),
                ...(verbosity === RunVerbosity.Quiet
                    ? { label: false as const, log: () => false }
                    : {}),
            };
            let currentContext: string | undefined;
            if (runtime === ContainerRuntime.Docker) {
                const result = await exec(runtime, ['context', 'inspect'], {
                    ...options,
                    env: { ...env, DOCKER_CONFIG: process.env.DOCKER_CONFIG },
                    capture: true,
                    sanitizeStdout: () => '[Docker connection metadata withheld]\n',
                });
                const [context] = JSON.parse(result.stdout) as {
                    Name: string;
                    Storage: { MetadataPath: string; TLSPath: string };
                    TLSMaterial: Record<string, string[]>;
                }[];
                currentContext = context.Name;
                if (currentContext !== 'default') {
                    await fs.cp(
                        context.Storage.MetadataPath,
                        path.join(
                            directory,
                            'contexts/meta',
                            path.basename(context.Storage.MetadataPath),
                        ),
                        { recursive: true },
                    );
                    if (Object.values(context.TLSMaterial).some((files) => files.length)) {
                        await fs.cp(
                            context.Storage.TLSPath,
                            path.join(
                                directory,
                                'contexts/tls',
                                path.basename(context.Storage.TLSPath),
                            ),
                            { recursive: true },
                        );
                    }
                }
            }
            // A host entry prevents Docker from auto-detecting a default credential helper.
            await fs.writeFile(
                authFile,
                JSON.stringify({
                    auths: { [host]: {} },
                    ...(currentContext ? { currentContext } : {}),
                }),
                { mode: 0o600 },
            );
            const prefix = runtime === ContainerRuntime.Docker ? ['--config', directory] : [];
            // Explicit Podman auth paths disable the search through persistent Docker auth files.
            const auth = runtime === ContainerRuntime.Podman ? ['--authfile', authFile] : [];
            await exec(
                runtime,
                [...prefix, 'login', ...auth, '--username', username, '--password-stdin', host],
                { ...options, input: `${password}\n` },
            );
            for (const reference of references) {
                await exec(runtime, [...prefix, 'tag', local, reference], options);
                await exec(runtime, [...prefix, 'push', ...auth, reference], options);
            }
        } finally {
            await withCliCleanup(() => fs.rm(directory, { recursive: true, force: true }));
        }
        return;
    }
    for (const reference of references) {
        await run(['tag', local, reference], { cwd: rootDir, verbosity });
        await run(['push', reference], { cwd: rootDir, verbosity });
    }
}
