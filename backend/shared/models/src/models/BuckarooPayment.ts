import { column,Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";

export class BuckarooPayment extends Model {
    static table = "buckaroo_payments";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    paymentId: string;

    @column({ type: "string" })
    transactionKey: string;
}
