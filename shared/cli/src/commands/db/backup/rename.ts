import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { renameBackup, resolveBackupOption } from '../../../runtime/db-backup-helpers.js';

export default class DbBackupRename extends BaseCommand {
    static summary = 'Rename a local MySQL data volume backup';
    static description = 'Use this to rename a backup created with `stam db backup`.';
    static examples = [
        'stam db backup rename --from before-migration --to before-migration-old',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        from: Flags.string({ description: 'Backup name to rename from' }),
        to: Flags.string({ description: 'Backup name to rename to' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbBackupRename);
        const context = await this.createContext(flags);
        const from = await resolveBackupOption({ context, flag: flags.from, message: 'Select the backup to rename' });
        const to = await resolveBackupOption({ context, flag: flags.to, message: 'Enter the new backup name', customInput: true });

        await renameBackup(context, from, to);
        this.log(`Renamed local MySQL backup ${from} to ${to}.`);
    }
}
