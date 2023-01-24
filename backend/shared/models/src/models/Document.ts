
import { column, Model } from "@simonbackx/simple-database";
import { DocumentStatus, DocumentData } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class Document extends Model {
    static table = "documents";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: "string"})
    organizationId: string

    @column({ type: "string"})
    templateId: string

    /**
     * Used to give a member access to the document
     */
    @column({ type: "string", nullable: true })
    memberId: string | null = null

    /**
     * Used to identify document already created for a registration (= to update it)
     */
    @column({ type: "string", nullable: true })
    registrationId: string | null = null

    @column({ type: "string" })
    status = DocumentStatus.Draft

    /**
     * Settings of the document. This information is public
     */
    @column({ type: "json", decoder: DocumentData })
    data = DocumentData.create({})

    @column({ type: "datetime" })
    createdAt: Date = new Date()

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
