import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel, SQL, SQLWhereSign } from '@stamhoofd/sql';
import { PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem } from './BalanceItem';
import { Member } from './Member';
import { Organization } from './Organization';
import { Platform } from './Platform';
import { Registration } from './Registration';
import { RegistrationPeriod } from './RegistrationPeriod';

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

    canDelete() {
        if (this.balanceItemId) {
            return false;
        }
        return true;
    }

    delete(): Promise<void> {
        throw new Error('Cannot delete a membership. Use the deletedAt column.');
    }

    async isElegibleForTrial(member: Member) {
        const period = await RegistrationPeriod.getByID(this.periodId);
        if (!period) {
            return false;
        }

        if (!period.previousPeriodId) {
            // We have no previous period = no data = no trials
            return false;
        }

        const platform = await Platform.getSharedStruct();
        const typeIds = platform.config.membershipTypes.filter(m => m.behaviour === PlatformMembershipTypeBehaviour.Period).map(m => m.id);

        const membership = await MemberPlatformMembership.select()
            .where('memberId', member.id)
            .where('deletedAt', null)
            .where('periodId', period.previousPeriodId)
            .where('membershipTypeId', typeIds)
            .first(false);

        const hasBlockingMemberships = !!membership;

        if (hasBlockingMemberships) {
            return false;
        }

        return true;
    }

    async calculatePrice(member: Member, registration?: Registration) {
        const platform = await Platform.getSharedPrivateStruct();
        const membershipType = platform.config.membershipTypes.find(m => m.id === this.membershipTypeId);

        if (!membershipType) {
            throw new SimpleError({
                code: 'invalid_membership_type',
                message: 'Unknown membership type',
                human: 'Deze aansluiting is niet (meer) beschikbaar',
            });
        }

        const periodConfig = membershipType.periods.get(this.periodId);

        if (!periodConfig) {
            throw new SimpleError({
                code: 'period_unavailable',
                message: 'Membership not available for this period',
                human: 'Deze aansluiting is nog niet beschikbaar voor dit werkjaar',
            });
        }

        const organization = await Organization.getByID(this.organizationId);
        if (!organization) {
            throw new SimpleError({
                // todo
                code: 'not_found',
                message: 'Organization not found',
                human: 'De organisatie is niet gevonden',
            });
        }

        const tagIds = organization.meta.tags;
        const shouldApplyReducedPrice = member.details.shouldApplyReducedPrice;

        const priceConfig = periodConfig.getPriceConfigForDate(membershipType.behaviour === PlatformMembershipTypeBehaviour.Days ? this.startDate : (this.createdAt ?? new Date()));
        const earliestPriceConfig = periodConfig.getPriceConfigForDate(membershipType.behaviour === PlatformMembershipTypeBehaviour.Days ? new Date(1950, 0, 1) : (new Date(1950, 0, 1)));

        let freeDays = 0;

        const d = this.createdAt ?? new Date();

        if (periodConfig.amountFree) {
            // Check if this organization has rights to free memberships
            const alreadyUsed = await MemberPlatformMembership.select()
                .where('organizationId', this.organizationId)
                .where('membershipTypeId', this.membershipTypeId)
                .where('periodId', this.periodId)
                .where('deletedAt', null)
                .whereNot('id', this.id)
                .where(
                    SQL.where('createdAt', SQLWhereSign.Less, d)
                        .or(
                            SQL.where('createdAt', SQLWhereSign.Equal, d)
                                .and('id', SQLWhereSign.Less, this.id),
                        ),
                )
                .sum(SQL.column('maximumFreeAmount'));

            if (alreadyUsed < periodConfig.amountFree) {
                freeDays = periodConfig.amountFree - alreadyUsed;
                console.log('Free membership created for ', this.id, periodConfig.amountFree, alreadyUsed);
            }
            else {
                console.log('No free membership created for', this.id, periodConfig.amountFree, alreadyUsed);
            }
        }

        if (membershipType.behaviour === PlatformMembershipTypeBehaviour.Days) {
            // Make sure time is equal between start and end date
            let startBrussels = Formatter.luxon(this.startDate);
            let endBrussels = Formatter.luxon(this.endDate);
            startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
            endBrussels = endBrussels.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
            this.startDate = startBrussels.toJSDate();
            this.endDate = endBrussels.toJSDate();

            this.expireDate = null;

            const days = Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
            this.maximumFreeAmount = days;
            this.priceWithoutDiscount = earliestPriceConfig.calculatePrice(tagIds, false, days);
            this.price = priceConfig.calculatePrice(tagIds, shouldApplyReducedPrice, Math.max(0, days - freeDays));
            this.freeAmount = Math.min(days, freeDays);
        }
        else {
            this.priceWithoutDiscount = earliestPriceConfig.getBasePrice(tagIds, false);
            this.price = priceConfig.getBasePrice(tagIds, shouldApplyReducedPrice);
            this.endDate = periodConfig.endDate;
            this.expireDate = periodConfig.expireDate;
            this.maximumFreeAmount = this.price > 0 ? 1 : 0;
            this.freeAmount = 0;

            if (freeDays > 0) {
                this.price = 0;
                this.freeAmount = 1;
            }

            // Alter start date
            if (registration && registration.startDate) {
                this.startDate = periodConfig.startDate;

                if (registration.startDate > periodConfig.startDate && registration.startDate < periodConfig.endDate) {
                    let startBrussels = Formatter.luxon(registration.startDate);
                    startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                    this.startDate = startBrussels.toJSDate();
                }
            }
            else {
                let startBrussels = Formatter.luxon(this.startDate);
                startBrussels = startBrussels.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                this.startDate = startBrussels.toJSDate();
            }
        }

        if (periodConfig.trialDays) {
            // Check whether you are elegible for a trial
            if (await this.isElegibleForTrial(member)) {
                // Allowed to set trial until, maximum periodConfig.trialDays after startDate
                let trialUntil = Formatter.luxon(this.startDate).plus({ days: periodConfig.trialDays });
                trialUntil = trialUntil.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });

                // Max end date
                if (trialUntil.toJSDate() > this.endDate) {
                    trialUntil = Formatter.luxon(this.endDate).set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
                }

                this.trialUntil = trialUntil.toJSDate();
            }
            else {
                this.trialUntil = null;
            }
        }
        else {
            // No trial
            this.trialUntil = null;
        }

        // Never charge itself
        const chargeVia = platform.membershipOrganizationId;
        if (this.organizationId === chargeVia) {
            this.price = 0;
            this.priceWithoutDiscount = 0;
            this.freeAmount = 0;
        }

        if (this.balanceItemId) {
            this.maximumFreeAmount = this.freeAmount;

            // Also update the balance item
            const balanceItem = await BalanceItem.getByID(this.balanceItemId);
            if (balanceItem) {
                balanceItem.unitPrice = this.price;
                await balanceItem.save();

                await BalanceItem.updateOutstanding([balanceItem]);
            }
        }
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
