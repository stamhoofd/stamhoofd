
import { column, Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";

export class MemberPlatformMembership extends Model {
    static table = "member_platform_memberships";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    memberId: string;

    @column({ type: "string" })
    membershipTypeId: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string" })
    periodId: string;

    @column({ type: "date" })
    startDate: Date;

    @column({ type: "date" })
    endDate: Date;

    @column({ type: "string", nullable: true })
    invoiceItemDetailId: string | null = null;

    @column({ type: "string", nullable: true })
    invoiceId: string | null = null;

    @column({ type: "integer" })
    price = 0;

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

}
