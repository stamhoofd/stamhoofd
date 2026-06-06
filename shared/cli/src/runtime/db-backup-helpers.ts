import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { input, select } from '@inquirer/prompts';
import type { CliContext } from '../context/create-context.js';
import { mysqlDataVolume, mysqlImage } from '../config/shared-service-config.js';
import { mysqlService } from '../services/definitions/mysql-service.js';
import * as docker from '../services/docker.js';
import { step } from './ux.js';

export type BackupInfo = {
    name: string;
    path: string;
    createdAt: Date;
    sizeBytes: number;
};

const backupNamePattern = /^[a-z0-9](?:[\w.-]*[a-z0-9])?$/i;

export function isValidBackupName(name: string): boolean {
    return backupNamePattern.test(name);
}

export function defaultBackupName(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function backupsDir(context: CliContext): string {
    return path.join(context.generatedDir, 'db-backups');
}

export function backupPath(context: CliContext, name: string): string {
    return path.join(backupsDir(context), name);
}

export async function backupExists(context: CliContext, name: string): Promise<boolean> {
    return await pathExists(backupPath(context, name));
}

export async function listBackups(context: CliContext): Promise<BackupInfo[]> {
    const dir = backupsDir(context);
    let entries: Dirent[];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    const backups = await Promise.all(
        entries.filter(entry => entry.isDirectory()).map(async (entry): Promise<BackupInfo> => {
            const backupDir = path.join(dir, entry.name);
            const stats = await fs.stat(backupDir);
            return {
                name: entry.name,
                path: backupDir,
                createdAt: stats.birthtime,
                sizeBytes: await directorySize(backupDir),
            };
        }),
    );

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const customBackupNameValue = '__stamhoofd_custom_backup_name__';

export async function resolveBackupOption(options: { context: CliContext; flag: string | undefined; message: string; customInput?: boolean }): Promise<string> {
    if (options.flag) {
        return options.flag;
    }

    const backups = await listBackups(options.context);
    if (backups.length === 0 && !options.customInput) {
        throw new Error('No local MySQL backups found. Pass a backup name explicitly.');
    }

    const selected = await select({
        message: options.message,
        choices: [
            ...backups.map(backup => ({ name: backup.name, value: backup.name })),
            ...(options.customInput ? [{ name: 'Enter a custom backup name...', value: customBackupNameValue }] : []),
        ],
    });

    if (selected !== customBackupNameValue) {
        return selected;
    }

    return await input({
        message: 'Enter the backup name',
        validate: value => isValidBackupName(value.trim()) || 'Use letters, numbers, dashes, underscores, or dots.',
    });
}

export async function createBackup(context: CliContext, name: string): Promise<void> {
    await docker.requireDocker();
    const dir = backupPath(context, name);
    await fs.mkdir(backupsDir(context), { recursive: true });

    const status = await mysqlService.status(context);
    if (status.running) {
        await step(`Stopping ${mysqlService.name}`, () => mysqlService.stop(context));
    }

    try {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
        await step(`Backing up MySQL data to "${name}"`, () => docker.copyVolumeToDirectory(mysqlDataVolume, dir, mysqlImage, context.verbose));
    }
    finally {
        if (status.running) {
            await step(`Starting ${mysqlService.name}`, () => mysqlService.start(context, undefined));
        }
    }
}

export async function restoreBackup(context: CliContext, name: string): Promise<void> {
    await docker.requireDocker();
    const dir = backupPath(context, name);

    await step(`Stopping ${mysqlService.name}`, () => mysqlService.stop(context));
    await step('Replacing the MySQL data volume', async () => {
        await docker.removeVolume(mysqlDataVolume, context.verbose);
        await docker.createVolume(mysqlDataVolume, context.verbose);
    });
    await step(`Restoring MySQL data from "${name}"`, () => docker.copyDirectoryToVolume(dir, mysqlDataVolume, mysqlImage, context.verbose));
    await step(`Starting ${mysqlService.name}`, () => mysqlService.start(context, undefined));
}

export async function renameBackup(context: CliContext, from: string, to: string): Promise<void> {
    const fromDir = backupPath(context, from);
    const toDir = backupPath(context, to);

    if (!await pathExists(fromDir)) {
        throw new Error(`No backup named "${from}" found.`);
    }
    if (await pathExists(toDir)) {
        throw new Error(`A backup named "${to}" already exists.`);
    }

    await fs.rename(fromDir, toDir);
}

export async function removeBackup(context: CliContext, name: string): Promise<void> {
    const dir = backupPath(context, name);
    if (!await pathExists(dir)) {
        throw new Error(`No backup named "${name}" found.`);
    }
    await fs.rm(dir, { recursive: true, force: true });
}

async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    }
    catch {
        return false;
    }
}

async function directorySize(dir: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            total += await directorySize(entryPath);
        }
        else if (entry.isFile()) {
            total += (await fs.stat(entryPath)).size;
        }
    }
    return total;
}
