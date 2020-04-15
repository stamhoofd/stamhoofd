import { Model } from "@/database/classes/Model";
import { column } from "@/database/decorators/Column";
import { Database } from "@/database/classes/Database";
import { ManyToOneRelation } from "@/database/classes/ManyToOneRelation";
import { Organization } from '@/organizations/models/Organization';

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
