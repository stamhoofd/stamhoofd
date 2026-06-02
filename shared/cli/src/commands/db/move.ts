import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { copyDatabase, currentDatabase, dropDatabase, resolveDatabaseOption } from '../../runtime/database-command-helpers.js';

export default class DbMove extends BaseCommand {
    static aliases = ['db mv'];
    static summary = 'Move a local MySQL database';
    static description = 'Use this to move one local MySQL database to another database name.';
    static examples = [
        'stam db move --from stamhoofd-development --to stamhoofd-development-old',
        'stam db mv --env keeo --from stamhoofd-keeo --to stamhoofd-keeo-copy',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        from: Flags.string({ description: 'Database name to move from' }),
        to: Flags.string({ description: 'Database name to move to' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbMove);
        const context = await this.createContext(flags);
        const current = currentDatabase(context);
        const from = await resolveDatabaseOption({ flag: flags.from, message: 'Select the database to move from', current, includeCurrent: false });
        const to = await resolveDatabaseOption({ flag: flags.to, message: 'Select the database to move to', current, includeCurrent: true, customInput: true });

        await copyDatabase(from, to);
        await dropDatabase(from);
        this.log(`Moved local MySQL database ${from} to ${to}.`);
    }
}
