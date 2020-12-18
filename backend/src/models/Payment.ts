import { column,Model } from '@simonbackx/simple-database';
import { PaymentMethod, PaymentStatus, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class Payment extends Model {
    static table = "payments"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    method: PaymentMethod | null = null;

    @column({ type: "string" })
    status: PaymentStatus;

    @column({ type: "integer" })
    price: number;

    @column({ type: "string", nullable: true })
    transferDescription: string | null = null;

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
        }
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    paidAt: Date | null = null

    static generateDescription(settings: TransferSettings, reference: string) {
        if (settings.type == TransferDescriptionType.Structured) {
            return this.generateOGM()
        }

        if (settings.type == TransferDescriptionType.Reference) {
            return (settings.prefix ? (settings.prefix + " ") : "" ) + reference
        }

        return settings.prefix
    }

    static generateOGM() {
        /**
         * De eerste tien cijfers zijn bijvoorbeeld een klantennummer of een factuurnummer. 
         * De laatste twee cijfers vormen het controlegetal dat verkregen wordt door van de 
         * voorgaande tien cijfers de rest bij Euclidische deling door 97 te berekenen (modulo 97). 
         * Voor en achter de cijfers worden drie plussen (+++) of sterretjes (***) gezet.
         * 
         * Uitzondering: Indien de rest 0 bedraagt, dan wordt als controlegetal 97 gebruikt.[1]
         */

        const firstChars = Math.round(Math.random() * 9999999999)
        let modulo = firstChars % 97
        if (modulo == 0) {
            modulo = 97
        }

        const str = (firstChars + "").padStart(10, "0") + (modulo + "").padStart(2, "0")

        return "+++"+str.substr(0, 3) + "/" + str.substr(3, 4) + "/"+str.substr(3 + 4)+"+++"
    }
}