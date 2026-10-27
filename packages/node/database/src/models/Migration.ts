import { Database } from '../classes/Database.js';
import { Model } from '../classes/Model.js';
import { column } from '../decorators/Column.js';

export class Migration extends Model {
    static table = 'migrations';

    // Columns
    @column({ primary: true, type: 'integer' })
    id: number | null = null;

    @column({ type: 'string' })
    file: string;

    @column({ type: 'datetime' })
    executedOn: Date;

    private static cleanFileName(file: string) {
        // Replace .ts with .js, to avoid rerunning same file depending whether ts-node is used
        file = file.replace('.ts', '.js');

        return file;
    }

    // Methods
    static async isExecuted(file: string): Promise<boolean> {
        file = this.cleanFileName(file);

        const [rows] = await Database.select(`SELECT count(*) as c FROM ${this.table} WHERE \`file\` = ? LIMIT 1`, [
            file,
        ]);

        if (rows.length === 0) {
            return false;
        }

        // Read member + address from first row
        return rows[0]['']['c'] === 1;
    }

    static async markAsExecuted(file: string): Promise<void> {
        if (await this.isExecuted(file)) {
            return;
        }
        file = this.cleanFileName(file);
        const migration = new Migration();
        migration.file = file;
        migration.executedOn = new Date();
        await migration.save();
    }
}
