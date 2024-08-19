import { column, Model, SQLResultNamespacedRow } from "@simonbackx/simple-database";
import { AnyDecoder } from "@simonbackx/simple-encoding";
import { SQL, SQLSelect } from "@stamhoofd/sql";
import { EmailTemplate as EmailTemplateStruct, EmailTemplateType } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";


/**
 * Holds the challenges for a given email. User should not exist, since that would allow user enumeration attacks
 */
export class EmailTemplate extends Model {
    static table = "email_templates";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string"})
    subject: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null;

    @column({ type: "string", nullable: true })
    groupId: string | null = null;

    @column({ type: "string", nullable: true })
    webshopId: string | null = null;

    @column({ type: "string" })
    type: EmailTemplateType; // should be enumeration

    /** Raw json structure to edit the template */ 
    @column({ type: "json", decoder: AnyDecoder })
    json: any;

    /** Template converted to HTML, with the {{replacements}} already correctly in place */
    @column({ type: "string" })
    html: string;

    @column({ type: "string" })
    text: string;

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

    getStructure() {
        return EmailTemplateStruct.create(this)
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): EmailTemplate => {
            const d = (this as typeof EmailTemplate & typeof Model).fromRow(row[this.table] as any) as EmailTemplate|undefined

            if (!d) {
                throw new Error("EmailTemplate not found")
            }

            return d;
        }
        
        const select = new SQLSelect(transformer, SQL.wildcard())
        return select.from(SQL.table(this.table))
    }
}
