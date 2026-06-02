import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { mysqlDataVolume, rustfsDataVolume } from '../config/shared-service-config.js';
import { logsDir, sharedDir } from '../runtime/manifest-store.js';
import { run } from '../runtime/command-runner.js';
import { CaddyService } from './definitions/caddy-service.js';
import { CorednsService } from './definitions/coredns-service.js';
import { MaildevService } from './definitions/maildev-service.js';
import { MysqlService } from './definitions/mysql-service.js';
import { RustfsService } from './definitions/rustfs-service.js';
import * as docker from './docker.js';
import { allRunning, printServicesStatus, removeSharedServicesManifest, restartServicesInteractive, startServices, startServicesInteractive, stopServices, stopServicesInteractive, writeSharedServicesManifest } from './manager.js';
import { sharedServiceDefinitions } from './registry.js';

export { CaddyService, CorednsService, MaildevService, MysqlService, RustfsService };

export async function sharedServicesRunning(context: CliContext): Promise<boolean> {
    return await allRunning(context, sharedServiceDefinitions);
}

export async function startSharedServices(context: CliContext): Promise<void> {
    await fs.mkdir(sharedDir(context), { recursive: true });
    await fs.mkdir(path.join(logsDir(context), 'shared'), { recursive: true });
    await startServices(context, sharedServiceDefinitions);
    await writeSharedServicesManifest(context);
}

export async function startSharedServicesInteractive(context: CliContext): Promise<void> {
    await fs.mkdir(sharedDir(context), { recursive: true });
    await fs.mkdir(path.join(logsDir(context), 'shared'), { recursive: true });
    await startServicesInteractive(context, sharedServiceDefinitions);
    await writeSharedServicesManifest(context);
}

export async function stopSharedServices(context: CliContext): Promise<void> {
    await stopServices(context, sharedServiceDefinitions);
    await removeSharedServicesManifest(context);
}

export async function stopSharedServicesInteractive(context: CliContext): Promise<void> {
    await stopServicesInteractive(context, sharedServiceDefinitions);
    await removeSharedServicesManifest(context);
}

export async function deleteSharedServicesData(context: CliContext): Promise<void> {
    await docker.removeVolume(mysqlDataVolume, context.verbose);
    await docker.removeVolume(rustfsDataVolume, context.verbose);
    await fs.rm(sharedDir(context), { recursive: true, force: true });
    await fs.rm(CaddyService.dataDir(), { recursive: true, force: true });
}

export async function restartSharedServicesInteractive(context: CliContext): Promise<void> {
    await fs.mkdir(sharedDir(context), { recursive: true });
    await fs.mkdir(path.join(logsDir(context), 'shared'), { recursive: true });
    await restartServicesInteractive(context, sharedServiceDefinitions);
    await writeSharedServicesManifest(context);
}

export async function printSharedServicesStatus(context: CliContext): Promise<void> {
    await printServicesStatus(context, sharedServiceDefinitions);
}

export async function tailSharedLogs(): Promise<void> {
    const runtime = await docker.getContainerRuntime();
    await run('yarn', [
        '-s',
        'concurrently',
        '-n',
        'MySQL,MailDev,RustFS,CoreDNS,Caddy',
        `${runtime} logs -f stamhoofd-mysql`,
        `${runtime} logs -f stamhoofd-maildev`,
        `${runtime} logs -f stamhoofd-rustfs`,
        `${runtime} logs -f stamhoofd-coredns`,
        `${runtime} logs -f stamhoofd-caddy`,
    ], { allowFailure: true });
}
