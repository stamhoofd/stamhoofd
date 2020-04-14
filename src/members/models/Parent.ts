import { Model } from "@/database/classes/Model";
import { column } from "@/database/decorators/Column";
import { Address } from "./Address";
import { ManyToOneRelation } from "@/database/classes/ManyToOneRelation";

export class Parent extends Model {
    static table = "parents";

    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    firstName: string;

    @column({ type: "string" })
    lastName = "";

    @column({ type: "string" })
    phone: string | null = null;

    @column({ type: "string" })
    mail: string | null = null;

    @column({ foreignKey: Parent.address, type: "integer" })
    addressId: number | null = null; // null = no address

    static address = new ManyToOneRelation(Address, "address");
}
