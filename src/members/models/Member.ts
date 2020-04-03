import { Gender } from "./Gender";
import { Address } from "./Address";
import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";
import { Database } from "../../database/classes/Database";
import { ManyToOneRelation } from "../../database/classes/ManyToOneRelation";
import { ManyToManyRelation } from "../../database/classes/ManyToManyRelation";
import { Parent } from "./Parent";

/// Loaded types
export type FullyLoadedMember = Member & { address: Address | null; parents: Parent[] };

export class Member extends Model {
    static table = "members";

    // Columns
    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    firstName: string;

    @column({ type: "string" })
    lastName = "";

    @column({ type: "string" })
    gender: Gender = Gender.Other;

    @column({ type: "string", nullable: true })
    phone: string | null = null;

    @column({ type: "string", nullable: true })
    mail: string | null = null;

    @column({ type: "date", nullable: true })
    birthDay: Date | null = null;

    @column({ foreignKey: Member.address, type: "integer", nullable: true })
    addressId: number | null = null; // null = no address

    @column({ type: "datetime" })
    createdOn: Date = new Date();

    /*
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/

    // Relations
    static address = new ManyToOneRelation(Address, "address");
    static parents = new ManyToManyRelation(Member, Parent, "parents");

    // Methods
    static async getByID(id: number): Promise<FullyLoadedMember | undefined> {
        const [rows] = await Database.select(
            `
            SELECT * 
            FROM ${this.table} 
            ${Member.address.joinQuery(this.table, "addresses")}
            ${Member.parents.joinQuery(this.table, "parents")}
            WHERE members.${this.primary.name} = ?
            LIMIT 1
        `,
            [id]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        const member = this.fromRow(rows[0][this.table]);

        if (!member) {
            return undefined;
        }
        const address = Address.fromRow(rows[0]["addresses"]) || null;

        // Get parents from other rows
        const parents = Parent.fromRows(rows, "parents");

        return member.setOptionalRelation(Member.address, address).setManyRelation(Member.parents, parents);
    }

    logCountry(this: FullyLoadedMember) {
        console.log(this.address?.country ?? "unknown");
    }
}
