import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { defaultOutputWriter, type OutputWriter } from './output-target.js';

const CurrentManifestVersion = '2';

/** Distinguishes the process types that can publish local routes into shared Caddy/CoreDNS config. */
export enum RouteManifestKind {
    DevInstance = 'dev-instance',
    PlaywrightWorker = 'playwright-worker',
    SharedService = 'shared-service',
    SgvMock = 'sgv-mock',
    Sso = 'sso',
}

export type RouteManifest = {
    version: string;
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

export type ServiceRouteRegistration = {
    name: string;
    kind: RouteManifestKind;
    routes: RouteManifestRoute[];
    expiresAt?: string;
};

export async function writeRouteManifest(context: CliContext, manifest: RouteManifest): Promise<void> {
    await fs.mkdir(instanceDir(context), { recursive: true });
    await fs.writeFile(instancePath(context, manifest.name), JSON.stringify(manifest, null, 4));
}

/** Registers routes for the current process and records its pid so stale manifests can be pruned automatically. */
export async function registerServiceRoutes(context: CliContext, registration: ServiceRouteRegistration): Promise<void> {
    await writeRouteManifest(context, {
        version: CurrentManifestVersion,
        name: registration.name,
        kind: registration.kind,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        expiresAt: registration.expiresAt,
        rootPath: context.rootDir,
        workspace: context.workspace,
        routes: registration.routes,
        tlsSubjects: [...new Set(registration.routes.flatMap(route => route.hosts))],
    });
}

export async function removeRouteManifest(context: CliContext, name: string): Promise<void> {
    await fs.rm(instancePath(context, name), { force: true });
}

export async function unregisterServiceRoutes(context: CliContext, name: string): Promise<void> {
    await removeRouteManifest(context, name);
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
            const manifest = parseRouteManifest(raw, { writeOutputLine: options.writeOutputLine });
            return manifest ? { path: filePath, manifest } : { path: filePath };
        }
        catch (error) {
            writeOutputLine(`${chalk.yellow('!')} Ignoring invalid route manifest ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return { path: filePath };
        }
    }));
}

function parseRouteManifest(value: unknown, options: { writeOutputLine?: OutputWriter } = {}): RouteManifest | undefined {
    const writeOutputLine = options.writeOutputLine ?? defaultOutputWriter;

    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const raw = value as Partial<RouteManifest>;
    if (raw.version !== CurrentManifestVersion) {
        writeOutputLine(`${chalk.yellow('!')} Ignoring old manifest: please restart all services`);
        return undefined;
    }

    if (isRouteManifestKind(raw.kind) && Array.isArray(raw.routes) && Array.isArray(raw.tlsSubjects)) {
        return raw as RouteManifest;
    }
    return undefined;
}

function isRouteManifestKind(kind: unknown): kind is RouteManifestKind {
    return typeof kind === 'string' && Object.values(RouteManifestKind).includes(kind as RouteManifestKind);
}

function isRouteManifestActive(manifest: RouteManifest): boolean {
    if (manifest.expiresAt && Date.parse(manifest.expiresAt) <= Date.now()) {
        return false;
    }
    if (manifest.pid !== undefined && !processIsAlive(manifest.pid)) {
        return false;
    }
    return true;
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
