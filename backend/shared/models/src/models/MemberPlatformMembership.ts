
import { column, Model, SQLResultNamespacedRow } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { SQL, SQLSelect } from "@stamhoofd/sql";
import { PlatformMembershipTypeBehaviour } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { Member } from "./Member";
import { Organization } from "./Organization";
import { Platform } from "./Platform";

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
    balanceItemId: string | null = null;

    @column({ type: "integer" })
    price = 0;

    /**
     * Whether this was added automatically by the system
     */
    @column({ type: "boolean" })
    generated = false

    @column({
        type: "datetime", nullable: true
    })
    deletedAt: Date|null = null

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
        if (this.balanceItemId) {
            return false;
        }
        return true;
    }

    delete(): Promise<void> {
        throw new Error('Cannot delete a membership. Use the deletedAt column.');
    }

    async calculatePrice() {
        if (this.balanceItemId) {
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

        const organization = await Organization.getByID(this.organizationId);
        if(!organization) {
            throw new SimpleError({
                //todo
                code: 'not_found',
                message: 'Organization not found',
                human: 'De organisatie is niet gevonden'
            })
        }
        const member = await Member.getByID(this.memberId);
        if(!member) {
            throw new SimpleError({
                //todo
                code: 'not_found',
                message: 'Member not found',
                human: 'Het lid is niet gevonden'
            })
        }

        const tagIds = organization.meta.tags;
        const shouldApplyReducedPrice = member.details.shouldApplyReducedPrice;

        const priceConfig = periodConfig.getPriceConfigForDate(membershipType.behaviour === PlatformMembershipTypeBehaviour.Days ? this.startDate : (this.createdAt ?? new Date()));
        
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
            this.price = priceConfig.calculatePrice(tagIds, shouldApplyReducedPrice, days);
        } else {
            this.price = priceConfig.getBasePrice(tagIds, shouldApplyReducedPrice);
            this.startDate = periodConfig.startDate;
            this.endDate = periodConfig.endDate;
            this.expireDate = periodConfig.expireDate;
        }
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): MemberPlatformMembership => {
            const d = (this as typeof MemberPlatformMembership & typeof Model).fromRow(row[this.table] as any) as MemberPlatformMembership|undefined

            if (!d) {
                throw new Error("MemberPlatformMembership not found")
            }

            return d;
        }
        
        const select = new SQLSelect(transformer, SQL.wildcard())
        return select.from(SQL.table(this.table))
    }
}
