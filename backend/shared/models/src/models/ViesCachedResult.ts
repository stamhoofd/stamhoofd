import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';

export class ViesCachedResult extends QueryableModel {
    static table = 'vies_cached_results';

    @column({ primary: true, type: 'string' })
    VATNumber: string;

    @column({ type: 'datetime' })
    checkedAt: Date;

    @column({ type: 'boolean' })
    result: boolean;

    static async saveResult(VATNumber: string, result: boolean, checkedAt: Date): Promise<void> {
        await Database.insert(
            `INSERT INTO \`${this.table}\` (\`VATNumber\`, \`checkedAt\`, \`result\`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \`checkedAt\` = VALUES(\`checkedAt\`), \`result\` = VALUES(\`result\`)`,
            [VATNumber, checkedAt, result],
        );
    }
}
