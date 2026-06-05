import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { copyDatabase, currentDatabase, resolveDatabaseOption } from '../../runtime/database-command-helpers.js';

export default class DbCopy extends BaseCommand {
    static aliases = ['db cp'];
    static summary = 'Copy a local MySQL database';
    static description = 'Use this to copy one local MySQL database to another database name.';
    static examples = [
        'stam db copy --from stamhoofd-development --to stamhoofd-development-backup',
        'stam db cp --env keeo --to stamhoofd-development-keeo-copy',
    ];
    static flags = {
        ...BaseCommand.instanceFlags,
        from: Flags.string({ description: 'Database name to copy from' }),
        to: Flags.string({ description: 'Database name to copy to' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(DbCopy);
        const context = await this.createContext(flags);
        const current = currentDatabase(context);
        const from = await resolveDatabaseOption({ flag: flags.from, message: 'Select the database to copy from', current, includeCurrent: false });
        const to = await resolveDatabaseOption({ flag: flags.to, message: 'Select the database to copy to', current, includeCurrent: true, customInput: true });

        await copyDatabase(from, to);
        this.log(`Copied local MySQL database ${from} to ${to}.`);
    }
}
