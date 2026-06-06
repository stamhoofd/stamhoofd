import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { backupExists, resolveBackupOption, restoreBackup } from '../../runtime/db-backup-helpers.js';
import { confirm, warning } from '../../runtime/ux.js';

export default class DbRestore extends BaseCommand {
    static summary = 'Restore the local MySQL data volume from a backup';
    static description = 'Restores a backup created with `stam db backup` by replacing the local MySQL Docker volume with the backed up data. This overwrites the current local MySQL data and restarts MySQL.';
    static examples = [
        'stam db restore',
        'stam db restore --name before-migration',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        name: Flags.string({ description: 'Name of the backup to restore' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbRestore);
        const context = await this.createContext(flags);
        const name = await resolveBackupOption({ context, flag: flags.name, message: 'Select the backup to restore' });

        if (!await backupExists(context, name)) {
            this.error(`No backup named "${name}" found.`);
        }

        if (!await confirm(`Restore "${name}"? This overwrites the current local MySQL data and restarts MySQL.`)) {
            warning('Restore skipped.');
            return;
        }

        await restoreBackup(context, name);
        this.log(`Restored the local MySQL data volume from "${name}".`);
    }
}
