import { column, Model } from "@simonbackx/simple-database";
import { STPackageMeta } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

export class STPackage extends Model {
    static table = "stamhoofd_packages";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    /**
     * We keep packages of deleted organizations for statistics, so this doesn't have a foreign key
     */
    @column({ type: "string"})
    organizationId: string

    @column({ type: "json", decoder: STPackageMeta })
    meta: STPackageMeta

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
    validAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    renewAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    disableAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    removeAt: Date | null = null

    static async getForOrganization(organizationId: string) {
        return await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: { sign: ">", value: new Date() }})
    }


    async activate() {
        if (this.validAt !== null) {
            return
        }
        this.validAt = new Date()
        await this.save()

        // TODO: Update the organizations modules
    }
}
