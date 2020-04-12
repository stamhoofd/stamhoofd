import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";
import { ManyToOneRelation } from '../../database/classes/ManyToOneRelation';
import { Address } from '../../members/models/Address';
import { OrganizationMetaStruct } from '../structs/OrganizationMetaStruct';
import { Database } from '../../database/classes/Database';

export class Organization extends Model {
    static table = "organizations";

    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    name: string;

    @column({ type: "string" })
    website: string;

    @column({ foreignKey: Organization.address, type: "integer", nullable: true })
    addressId: number | null = null; // null = no address

    @column({ type: "json", decoder: OrganizationMetaStruct })
    meta: OrganizationMetaStruct;

    @column({ type: "datetime" })
    createdOn: Date;

    static address = new ManyToOneRelation(Address, "address");

    // Methods
    static async getByID(id: number): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE ${this.primary.name} = ? LIMIT 1`,
            [id]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }
}
