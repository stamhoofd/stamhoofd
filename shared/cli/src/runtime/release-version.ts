import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { run, RunVerbosity } from './command-runner.js';

type WorkspacePackage = { name: string; version: string; path: string; private?: boolean };

export async function getPublishablePackages(cwd: string): Promise<WorkspacePackage[]> {
    const result = await run('pnpm', ['-r', 'list', '--depth', '-1', '--json'], { cwd, capture: true, verbosity: RunVerbosity.Quiet });
    return (JSON.parse(result.stdout) as WorkspacePackage[]).filter(pkg => !pkg.private);
}

export async function getReleaseVersion(cwd: string): Promise<string> {
    const packages = await getPublishablePackages(cwd);
    const versions = new Set(packages.map(pkg => pkg.version));
    if (versions.size !== 1) {
        throw new Error('Publishable packages must have the same version');
    }
    return packages[0].version;
}

export async function bumpReleaseVersion(cwd: string): Promise<{ version: string; paths: string[] }> {
    const packages = await getPublishablePackages(cwd);
    const versions = new Set(packages.map(pkg => pkg.version));
    if (versions.size !== 1) {
        throw new Error('Publishable packages must have the same version');
    }
    const match = packages[0].version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`Cannot bump release version ${packages[0].version}`);
    }
    const version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
    const paths = packages.map(pkg => relative(cwd, join(pkg.path, 'package.json')));

    const files = await Promise.all(paths.map(async (path, index) => {
        const content = await readFile(join(cwd, path), 'utf8');
        const updated = content.replace(/("version": ")[^"]+("\s*,)/, `$1${version}$2`);
        if (updated === content || JSON.parse(updated).version !== version || JSON.parse(content).version !== packages[index].version) {
            throw new Error(`Could not update ${path}`);
        }
        return updated;
    }));
    await Promise.all(paths.map((path, index) => writeFile(join(cwd, path), files[index])));
    return { version, paths };
}
