import { BaseCommand } from '../../../base-command.js';
import { listBackups } from '../../../runtime/db-backup-helpers.js';
import { info, table } from '../../../runtime/ux.js';

export default class DbBackupList extends BaseCommand {
    static summary = 'List local MySQL data volume backups';
    static description = 'Use this to see the backups created with `stam db backup`, including when they were created and how large they are.';
    static examples = [
        'stam db backup list',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbBackupList);
        const context = await this.createContext(flags);
        const backups = await listBackups(context);

        if (backups.length === 0) {
            info('No local MySQL backups found. Create one with `stam db backup`.');
            return;
        }

        table(['NAME', 'CREATED', 'SIZE'], backups.map(backup => [
            backup.name,
            backup.createdAt.toLocaleString(),
            formatBytes(backup.sizeBytes),
        ]));
    }
}

function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
