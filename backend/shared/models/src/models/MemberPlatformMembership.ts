
import { column, Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";
import { Platform } from "./Platform";
import { PlatformMembershipTypeBehaviour } from "@stamhoofd/structures";
import { SimpleError } from "@simonbackx/simple-errors";
import { Formatter } from "@stamhoofd/utility";

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

    @column({ type: "date", nullable: true})
    expireDate: Date | null = null;

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

    canDelete() {
        if (this.invoiceId || this.invoiceItemDetailId) {
            return false;
        }
        return true;
    }

    async calculatePrice() {
        if (this.invoiceId || this.invoiceItemDetailId) {
            return;
        }

        const platform = await Platform.getShared();
        const membershipType = platform.config.membershipTypes.find(m => m.id == this.membershipTypeId);

        if (!membershipType) {
            throw new SimpleError({
                code: 'invalid_membership_type',
                message: 'Uknown membership type',
                human: 'Deze aansluiting is niet (meer) beschikbaar'
            })
        }

        const periodConfig = membershipType.periods.get(this.periodId)

        if (!periodConfig) {
            throw new SimpleError({
                code: 'period_unavailable',
                message: 'Membership not available for this period',
                human: 'Deze aansluiting is nog niet beschikbaar voor dit werkjaar'
            })
        }

        const priceConfig = periodConfig.getPriceForDate(membershipType.behaviour === PlatformMembershipTypeBehaviour.Days ? this.startDate : (this.createdAt ?? new Date()));
        

        if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
            // Make sure time is equal between start and end date
            let startBrussels = Formatter.luxon(this.startDate);
            let endBrussels = Formatter.luxon(this.endDate);
            startBrussels = startBrussels.set({hour: 0, minute: 0, second: 0, millisecond: 0});
            endBrussels = endBrussels.set({hour: 23, minute: 59, second: 59, millisecond: 0});
            this.startDate = startBrussels.toJSDate();
            this.endDate = endBrussels.toJSDate();

            this.expireDate = null

            const days = Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
            this.price = priceConfig.pricePerDay * days + priceConfig.price;
        } else {
            this.price = priceConfig.price;
            this.startDate = periodConfig.startDate;
            this.endDate = periodConfig.endDate;
            this.expireDate = periodConfig.expireDate;
        }
    }
}
