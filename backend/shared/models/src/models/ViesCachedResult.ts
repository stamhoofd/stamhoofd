import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';

export class ViesCachedResult extends QueryableModel {
    static table = 'vies_cached_results';

    @column({ primary: true, type: 'string' })
    id: string;

    @column({ type: 'datetime' })
    checkedAt: Date;

    @column({ type: 'boolean' })
    result: boolean;

    static async saveResult(id: string, result: boolean, checkedAt: Date): Promise<void> {
        await Database.insert(
            `INSERT INTO \`${this.table}\` (\`id\`, \`checkedAt\`, \`result\`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \`checkedAt\` = VALUES(\`checkedAt\`), \`result\` = VALUES(\`result\`)`,
            [id, checkedAt, result],
        );
    }
}
