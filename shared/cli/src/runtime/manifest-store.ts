import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { defaultOutputWriter, type OutputWriter } from './output-target.js';

export type InstanceManifest = {
    name: string;
    kind?: RouteManifestKind;
    pid?: number;
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
        registration?: string;
        webshop?: string;
    };
    ports: ReturnType<typeof buildPorts>;
};

export type RouteManifestKind = 'instance' | 'playwright-worker';

export type RouteManifest = {
    name: string;
    kind: RouteManifestKind;
    pid?: number;
    startedAt: string;
    expiresAt?: string;
    rootPath: string;
    workspace: string;
    routes: RouteManifestRoute[];
    tlsSubjects: string[];
};

export type RouteManifestRoute = {
    hosts: string[];
    port: number;
};

export async function writeInstanceManifest(context: CliContext, domains: InstanceManifest['domains']): Promise<void> {
    const manifest: InstanceManifest = {
        name: context.instance.name,
        kind: 'instance',
        pid: process.pid,
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

export async function writeRouteManifest(context: CliContext, manifest: RouteManifest): Promise<void> {
    await fs.mkdir(instanceDir(context), { recursive: true });
    await fs.writeFile(instancePath(context, manifest.name), JSON.stringify(manifest, null, 4));
}

export async function removeRouteManifest(context: CliContext, name: string): Promise<void> {
    await fs.rm(instancePath(context, name), { force: true });
}

export async function removeRouteManifestsByKind(context: CliContext, kind: RouteManifestKind): Promise<void> {
    const manifests = await listRouteManifestEntries(context);
    await Promise.all(manifests
        .filter(entry => entry.manifest?.kind === kind)
        .map(entry => fs.rm(entry.path, { force: true })));
}

export async function pruneStaleRouteManifests(context: CliContext): Promise<void> {
    const entries = await listRouteManifestEntries(context);
    await Promise.all(entries
        .filter(entry => entry.manifest && !isRouteManifestActive(entry.manifest))
        .map(entry => fs.rm(entry.path, { force: true }).catch(() => undefined)));
}

export async function listActiveRouteManifests(context: CliContext, options: { writeOutputLine?: OutputWriter } = {}): Promise<RouteManifest[]> {
    const writeOutputLine = options.writeOutputLine ?? defaultOutputWriter;
    const entries = await listRouteManifestEntries(context, { writeOutputLine });
    const active: RouteManifest[] = [];
    const stale: string[] = [];

    for (const entry of entries) {
        if (!entry.manifest) {
            continue;
        }
        if (isRouteManifestActive(entry.manifest)) {
            active.push(entry.manifest);
            continue;
        }
        stale.push(entry.path);
    }

    await Promise.all(stale.map(file => fs.rm(file, { force: true }).catch(() => undefined)));
    return active;
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

export async function listActiveInstanceManifests(context: CliContext, options: { writeOutputLine?: OutputWriter } = {}): Promise<InstanceManifest[]> {
    const activeRouteManifests = await listActiveRouteManifests(context, options);
    const activeInstanceNames = new Set(activeRouteManifests.filter(manifest => manifest.kind === 'instance').map(manifest => manifest.name));
    const instanceManifests = await listInstanceManifests(context, options);
    return instanceManifests.filter(manifest => activeInstanceNames.has(manifest.name));
}

export function instanceManifestToRouteManifest(manifest: InstanceManifest): RouteManifest {
    const routes: RouteManifestRoute[] = [
        { hosts: [manifest.domains.renderer], port: manifest.ports.renderer },
        { hosts: [manifest.domains.api, `*.${manifest.domains.api}`], port: manifest.ports.api },
        { hosts: [manifest.domains.dashboard], port: manifest.ports.dashboard },
    ];

    if (manifest.domains.registration) {
        routes.push({ hosts: [manifest.domains.registration, `*.${manifest.domains.registration}`], port: manifest.ports.registration });
    }
    if (manifest.domains.webshop) {
        routes.push({ hosts: [manifest.domains.webshop], port: manifest.ports.webshop });
    }

    return {
        name: manifest.name,
        kind: 'instance',
        pid: manifest.pid,
        startedAt: manifest.startedAt,
        rootPath: manifest.rootPath,
        workspace: manifest.workspace,
        routes,
        tlsSubjects: [...new Set(routes.flatMap(route => route.hosts))],
    };
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

async function listRouteManifestEntries(context: CliContext, options: { writeOutputLine?: OutputWriter } = {}): Promise<Array<{ path: string; manifest?: RouteManifest }>> {
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

    return await Promise.all(files.map(async (file) => {
        const filePath = path.join(instanceDir(context), file);
        try {
            const raw = JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
            const manifest = parseRouteManifest(raw);
            return manifest ? { path: filePath, manifest } : { path: filePath };
        }
        catch (error) {
            writeOutputLine(`${chalk.yellow('!')} Ignoring invalid route manifest ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return { path: filePath };
        }
    }));
}

function parseRouteManifest(value: unknown): RouteManifest | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const raw = value as Partial<RouteManifest> & Partial<InstanceManifest>;
    if (raw.kind === 'playwright-worker' && Array.isArray(raw.routes) && Array.isArray(raw.tlsSubjects)) {
        return raw as RouteManifest;
    }
    if ((raw.kind === 'instance' || raw.kind === undefined) && raw.domains && raw.ports) {
        return instanceManifestToRouteManifest(raw as InstanceManifest);
    }
    return undefined;
}

function isRouteManifestActive(manifest: RouteManifest): boolean {
    if (manifest.expiresAt && Date.parse(manifest.expiresAt) <= Date.now()) {
        return false;
    }
    if (manifest.pid !== undefined && !processIsAlive(manifest.pid)) {
        return false;
    }
    return manifest.routes.every(route => route.port > 0 && route.hosts.length > 0 && route.hosts.every(host => host.length > 0));
}

function processIsAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
