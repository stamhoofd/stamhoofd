import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { currentDatabase, dropDatabase, resolveDatabaseOption } from '../../runtime/database-command-helpers.js';

export default class DbRemove extends BaseCommand {
    static aliases = ['db rm'];
    static summary = 'Remove a local MySQL database';
    static description = 'Use this to remove a local MySQL database.';
    static examples = [
        'stam db remove --from stamhoofd-development-backup',
        'stam db rm --env keeo',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        from: Flags.string({ description: 'Database name to remove' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbRemove);
        const context = await this.createContext(flags);
        const current = currentDatabase(context);
        const from = await resolveDatabaseOption({ flag: flags.from, message: 'Select the database to remove', current, includeCurrent: false });

        await dropDatabase(from);
        this.log(`Removed local MySQL database ${from}.`);
    }
}
