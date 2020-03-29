import { Model } from "../../database/classes/Model";
import { column } from "../../database/decorators/Column";

export class Address extends Model {
    static table = "addresses";

    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    street = "";

    @column({ type: "string" })
    number = "";

    @column({ type: "string" })
    postalCode = "";

    @column({ type: "string" })
    city = "";

    @column({ type: "string" })
    country = "BE";
}
