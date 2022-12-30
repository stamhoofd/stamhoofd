import { column,Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";

export class StripeCheckoutSession extends Model {
    static table = "stripe_checkout_sessions";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    paymentId: string;

    @column({ type: "string" })
    stripeSessionId: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null = null;
}
