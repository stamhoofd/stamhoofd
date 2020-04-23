import { Database } from "../classes/Database";
import { Model } from "../classes/Model";
import { column } from "../decorators/Column";

export class Migration extends Model {
    static table = "migrations";

    // Columns
    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    file: string;

    @column({ type: "datetime" })
    executedOn: Date;

    // Methods
    static async isExecuted(file: string): Promise<boolean> {
        const [rows] = await Database.select(`SELECT count(*) as c FROM ${this.table} WHERE \`file\` = ? LIMIT 1`, [
            file
        ]);

        if (rows.length == 0) {
            return false;
        }

        // Read member + address from first row
        return rows[0][""]["c"] == 1;
    }

    static async markAsExecuted(file: string) {
        if (await this.isExecuted(file)) {
            return;
        }
        const migration = new Migration();
        migration.file = file;
        migration.executedOn = new Date();
        await migration.save();
    }
}
