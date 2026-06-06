import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { removeBackup, resolveBackupOption } from '../../../runtime/db-backup-helpers.js';

export default class DbBackupRemove extends BaseCommand {
    static aliases = ['db backup rm'];
    static summary = 'Remove a local MySQL data volume backup';
    static description = 'Use this to remove a backup created with `stam db backup`.';
    static examples = [
        'stam db backup remove --from before-migration',
        'stam db backup rm --from nightly-snapshot',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        from: Flags.string({ description: 'Backup name to remove' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbBackupRemove);
        const context = await this.createContext(flags);
        const from = await resolveBackupOption({ context, flag: flags.from, message: 'Select the backup to remove' });

        await removeBackup(context, from);
        this.log(`Removed local MySQL backup ${from}.`);
    }
}
