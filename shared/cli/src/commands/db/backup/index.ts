import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { backupExists, createBackup, defaultBackupName, isValidBackupName } from '../../../runtime/db-backup-helpers.js';
import { confirm, warning } from '../../../runtime/ux.js';

export default class DbBackup extends BaseCommand {
    static summary = 'Backup the local MySQL data volume';
    static description = 'Creates a fast snapshot of the local MySQL Docker volume by copying its data directly, without using mysqldump. This stops MySQL while copying and restarts it afterwards if it was running.';
    static examples = [
        'stam db backup',
        'stam db backup --name before-migration',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        name: Flags.string({ description: 'Name for this backup (defaults to a timestamp-based name)' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbBackup);
        const context = await this.createContext(flags);
        const name = flags.name ?? defaultBackupName();

        if (!isValidBackupName(name)) {
            this.error(`"${name}" is not a valid backup name. Use letters, numbers, dashes, underscores, or dots.`);
        }

        if (await backupExists(context, name) && !await confirm(`A backup named "${name}" already exists. Overwrite it?`)) {
            warning('Backup skipped.');
            return;
        }

        await createBackup(context, name);
        this.log(`Backed up the local MySQL data volume to "${name}".`);
    }
}
