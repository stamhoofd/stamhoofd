import fs from 'node:fs/promises';
import path from 'node:path';
import { run, RunVerbosity } from './command-runner.js';

/** A single image reference is used for both local builds and registry publication. */
export function docsImageReference(tag: string, registry?: string): string {
    if (!/^\w[\w.-]{0,127}$/.test(tag)) {
        throw new Error('Invalid image tag. Use a version such as v1.2.3.');
    }
    if (registry !== undefined && !/^[a-z0-9.-]+(?::\d+)?\/[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(registry)) {
        throw new Error('STAM_DOCS_REGISTRY must be a registry host/namespace without a scheme or trailing slash.');
    }
    return `${registry ? `${registry}/` : ''}docs:${tag}`;
}

export async function buildDocsImage(rootDir: string, tag: string, verbosity = RunVerbosity.Output): Promise<void> {
    const nodeVersion = (await fs.readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim().replace(/^v/, '');
    await run('docker', ['build', '--platform', 'linux/amd64', '--file', 'docs/Dockerfile', '--build-arg', `NODE_VERSION=${nodeVersion}`, '--tag', docsImageReference(tag), '.'], { cwd: rootDir, verbosity });
}

/** Docker authentication is external: credentials never enter build arguments or image layers. */
export async function publishDocsImage(rootDir: string, tag: string, registry: string | undefined, verbosity = RunVerbosity.Output): Promise<void> {
    if (!registry) throw new Error('Set STAM_DOCS_REGISTRY to the destination registry host/namespace.');
    const local = docsImageReference(tag);
    const remote = docsImageReference(tag, registry);
    await run('docker', ['tag', local, remote], { cwd: rootDir, verbosity });
    await run('docker', ['push', remote], { cwd: rootDir, verbosity });
}
