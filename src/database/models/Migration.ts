import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";
import { Database } from "../../database/classes/Database";

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
        console.log(rows);

        // Read member + address from first row
        return rows[0][""]["c"] == 1;
    }

    static async markAsExecuted(file: string) {
        const migration = new Migration();
        migration.file = file;
        migration.executedOn = new Date();
        await migration.save();
    }
}
