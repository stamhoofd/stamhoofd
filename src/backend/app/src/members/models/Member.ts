import { Organization } from '@stamhoofd-backend/app/src/organizations/models/Organization';
import { Model } from "@stamhoofd-backend/database";
import { column } from "@stamhoofd-backend/database";
import { Database } from "@stamhoofd-backend/database";
import { ManyToOneRelation } from "@stamhoofd-backend/database";

/// Loaded types
export class Member extends Model {
    static table = "members";

    // Columns
    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ foreignKey: Member.organization, type: "integer" })
    organizationId: number;

    @column({ type: "string" })
    encrypted: string;

    @column({ type: "datetime" })
    createdOn: Date = new Date();

    @column({ type: "datetime" })
    updatedOn: Date = new Date();

    // Relations
    static organization = new ManyToOneRelation(Organization, "organization");

    // Methods
    static async getByID(id: number): Promise<Member | undefined> {
        const [rows] = await Database.select(
            `
            SELECT * 
            FROM ${this.table} 
            WHERE members.${this.primary.name} = ?
            LIMIT 1
        `,
            [id]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }
}
