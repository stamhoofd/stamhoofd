import { column, Model } from "@simonbackx/simple-database";
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Discount, DiscountCode } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class WebshopDiscountCode extends Model {
    static table = "webshop_discount_codes";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string" })
    webshopId: string;

    @column({ type: "string" })
    code: string;

    @column({ type: "string" })
    description = ''
    
    @column({ type: "json", decoder: new ArrayDecoder(Discount) })
    discounts: Discount[] = []

    @column({ type: "integer" })
    usageCount = 0

    @column({ type: "integer", nullable: true })
    maximumUsage: number|null = null

    // Unique representation of this webshop from a string, that is used to provide the default domains
    // in shop.stamhoofd.be/uri, and stamhoofd.be/shop/uri
    @column({ type: "boolean" })
    reserved = false;

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    getStructure(): DiscountCode {
        return DiscountCode.create(this)
    }

    static async getActiveCodes(webshopId: string, codes: string[]) {
        if (codes.length === 0) {
            return [];
        }

        let models = await WebshopDiscountCode.where({
            webshopId,
            code: {
                sign: 'IN',
                value: codes
            }
        });

        // Remove used discount codes
        models = models.filter(c => c.maximumUsage === null || c.maximumUsage > c.usageCount)
        return models;
    }
}
