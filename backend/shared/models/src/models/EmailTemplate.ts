import { column, Model } from "@simonbackx/simple-database";


/**
 * Holds the challenges for a given email. User should not exist, since that would allow user enumeration attacks
 */
export class EmailTemplate extends Model {
    static table = "email_templates";

    @column({ primary: true, type: "integer" })
    id: number;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string" })
    type: string; // should be enumeration

    /** Raw json structure to edit the template */ 
    @column({ type: "string" })
    json: string;

    /** Template converted to HTML, with the {{replacements}} already correctly in place */
    @column({ type: "string" })
    html: string;

   

    @column({
        type: "datetime", beforeSave() {
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
}
