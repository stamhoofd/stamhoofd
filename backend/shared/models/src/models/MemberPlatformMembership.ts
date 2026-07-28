import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem } from './BalanceItem.js';

export class MemberPlatformMembership extends QueryableModel {
    static table = 'member_platform_memberships';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    membershipTypeId: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'date' })
    startDate: Date;

    @column({ type: 'date' })
    endDate: Date;

    /**
     * This membership won't get charged before this day.
     * The membership can still get removed before this day.
     *
     * If a membership is deleted during trial -> do not set deletedAt, but set price to 0 and set trialUntil and endDate to the current date
     */
    @column({ type: 'date', nullable: true })
    trialUntil: Date | null = null;

    @column({ type: 'date', nullable: true })
    expireDate: Date | null = null;

    @column({ type: 'string', nullable: true })
    balanceItemId: string | null = null;

    @column({ type: 'integer' })
    price = 0;

    @column({ type: 'integer' })
    priceWithoutDiscount = 0;

    /**
     * Contains the amount of days, or either 1/0 to count the amount of 'free' days maximum could be awarded.
     * Set to 0 when already a different 'free' membership was created, so it shouldn't count for a free day
     */
    @column({ type: 'integer' })
    maximumFreeAmount = 0;

    @column({ type: 'integer' })
    freeAmount = 0;

    /**
     * Whether this was added automatically by the system
     */
    @column({ type: 'boolean' })
    generated = false;

    @column({
        type: 'datetime', nullable: true,
    })
    deletedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    // prevent deleting or changing price if true
    @column({ type: 'boolean' })
    locked = false;

    canDelete(hasPlatformFullAccess = false) {
        if (this.locked) {
            return false;
        }

        if (this.balanceItemId && !hasPlatformFullAccess) {
            return false;
        }
        return true;
    }

    delete(): Promise<void> {
        throw new Error('Cannot delete a membership. Use the deletedAt column.');
    }

    async doDelete() {
        this.deletedAt = new Date();
        await this.save();

        if (this.balanceItemId) {
            // Also update the balance item
            const balanceItem = await BalanceItem.getByID(this.balanceItemId);
            if (balanceItem) {
                await BalanceItem.deleteItems([balanceItem]);
            }
        }
    }
}
