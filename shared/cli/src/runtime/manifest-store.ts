import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { defaultOutputWriter, type OutputWriter } from './output-target.js';

export type InstanceManifest = {
    name: string;
    env: string;
    workspace: string;
    primary: boolean;
    prefix: string;
    portOffset: number;
    startedAt: string;
    rootPath: string;
    domains: {
        dashboard: string;
        api: string;
        renderer: string;
    };
    ports: ReturnType<typeof buildPorts>;
};

export async function writeInstanceManifest(context: CliContext, domains: InstanceManifest['domains']): Promise<void> {
    const manifest: InstanceManifest = {
        name: context.instance.name,
        env: context.env,
        workspace: context.workspace,
        primary: context.instance.primary,
        prefix: context.instance.prefix,
        portOffset: context.instance.portOffset,
        startedAt: new Date().toISOString(),
        rootPath: context.rootDir,
        domains,
        ports: buildPorts(context),
    };
    await fs.mkdir(instanceDir(context), { recursive: true });
    await fs.writeFile(instancePath(context, context.instance.name), JSON.stringify(manifest, null, 4));
}

export async function removeInstanceManifest(context: CliContext): Promise<void> {
    await fs.rm(instancePath(context, context.instance.name), { force: true });
}

export async function listInstanceManifests(context: CliContext, options: { writeOutputLine?: OutputWriter } = {}): Promise<InstanceManifest[]> {
    const writeOutputLine = options.writeOutputLine ?? defaultOutputWriter;
    let files: string[];

    try {
        files = (await fs.readdir(instanceDir(context))).filter(file => file.endsWith('.json'));
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    const manifests = await Promise.all(files.map(async (file) => {
        try {
            return JSON.parse(await fs.readFile(path.join(instanceDir(context), file), 'utf-8')) as InstanceManifest;
        }
        catch (error) {
            // One corrupt manifest should not hide the rest of the active instances.
            writeOutputLine(`${chalk.yellow('!')} Ignoring invalid instance manifest ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }));

    return manifests.filter((manifest): manifest is InstanceManifest => manifest !== undefined);
}

export function sharedDir(context: CliContext): string {
    return path.join(context.generatedDir, 'shared');
}

export function logsDir(context: CliContext): string {
    return path.join(context.generatedDir, 'logs');
}

function instanceDir(context: CliContext): string {
    return path.join(context.generatedDir, 'instances');
}

function instancePath(context: CliContext, name: string): string {
    return path.join(instanceDir(context), `${name}.json`);
}
