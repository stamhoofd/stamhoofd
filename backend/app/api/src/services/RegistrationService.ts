import { ManyToOneRelation } from '@simonbackx/simple-database';
import { BalanceItem, Document, Group, Member, Registration } from '@stamhoofd/models';
import { AppliedRegistrationDiscount, AuditLogSource, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, EmailTemplateType, StockReservation, TranslatedString, Version } from '@stamhoofd/structures';
import { AuditLogService } from './AuditLogService.js';
import { GroupService } from './GroupService.js';
import { PlatformMembershipService } from './PlatformMembershipService.js';
import { QueueHandler } from '@stamhoofd/queues';
import { Formatter } from '@stamhoofd/utility';
import { encodeObject } from '@simonbackx/simple-encoding';

export const RegistrationService = {
    /**
     * If the registration was marked valid, and later paid, we'll still shorten the trail until period
     */
    async markRepeatedPaid(registrationId: string) {
        const registration = await Registration.getByID(registrationId);
        if (!registration) {
            throw new Error('Registration not found');
        }

        if (registration.registeredAt !== null && registration.deactivatedAt === null) {
            // Already valid
            if (registration.trialUntil && registration.trialUntil > new Date()) {
                registration.trialUntil = new Date();
                await registration.save();
                await PlatformMembershipService.updateMembershipsForId(registration.memberId);
            }
        }
        // do nothing: possible that we canceled the registration and don't want to reactivate it when we mark something paid
    },

    async markValid(registrationId: string, options?: { paid?: boolean }) {
        const registration = await Registration.getByID(registrationId);
        if (!registration) {
            throw new Error('Registration not found');
        }

        if (registration.registeredAt !== null && registration.deactivatedAt === null) {
            // Already valid
            if (options?.paid && registration.trialUntil && registration.trialUntil > new Date()) {
                registration.trialUntil = new Date();
                await registration.save();
                await PlatformMembershipService.updateMembershipsForId(registration.memberId);
            }
            return false;
        }

        if (options?.paid && registration.trialUntil && registration.trialUntil > new Date()) {
            registration.trialUntil = new Date();
        }
        registration.reservedUntil = null;
        registration.registeredAt = registration.registeredAt ?? new Date();
        registration.deactivatedAt = null;
        registration.canRegister = false;
        await registration.save();
        RegistrationService.scheduleStockUpdate(registration.id);

        await PlatformMembershipService.updateMembershipsForId(registration.memberId);

        if (registration.sendConfirmationEmail) {
            await registration.sendEmailTemplate({
                type: EmailTemplateType.RegistrationConfirmation,
            });
        }

        const member = await Member.getByID(registration.memberId);
        if (member) {
            const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
            registrationMemberRelation.foreignKey = Member.registrations.foreignKey;
            await Document.updateForRegistration(registration.setRelation(registrationMemberRelation, member));
        }

        // Update group occupancy
        await GroupService.updateOccupancy(registration.groupId);

        return true;
    },

    async updateDiscounts(registrationId: string) {
        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            await QueueHandler.schedule('registration-discounts-update-' + registrationId, async function (this: undefined) {
                const registration = await Registration.getByID(registrationId);
                if (!registration) {
                    throw new Error('Registration not found');
                }

                // Fetch all discounts that have been granted to this registration
                const discountBalanceItems = await BalanceItem.select()
                    .where('registrationId', registrationId)
                    .where('organizationId', registration.organizationId)
                    .where('type', BalanceItemType.RegistrationBundleDiscount)
                    .where('status', BalanceItemStatus.Due)
                    .fetch();

                let before: string | undefined;
                if (STAMHOOFD.environment !== 'production') {
                    // This is an expensive operation, so keep track of whether it was actually necessary so we can detect performance issues
                    before = JSON.stringify(encodeObject(registration.discounts, { version: Version }));
                }

                // Reset registration discounts
                registration.discounts = new Map();

                for (const balanceItem of discountBalanceItems) {
                    const discount = balanceItem.relations.get(BalanceItemRelationType.Discount);
                    if (!discount) {
                        continue;
                    }

                    let existing = registration.discounts.get(discount.id);

                    if (!existing) {
                        existing = AppliedRegistrationDiscount.create({
                            name: discount.name,
                            amount: 0,
                        });
                        registration.discounts.set(discount.id, existing);
                    }
                    existing.amount += -balanceItem.price; // price is negative means it has been discounted, and we store a positive amount with the discount

                    if (existing.amount === 0) {
                        // Delete the discount
                        registration.discounts.delete(discount.id);
                    }
                }

                console.log('Saving updated discounts for', registrationId, registration.discounts);

                if (STAMHOOFD.environment !== 'production') {
                    const after = JSON.stringify(encodeObject(registration.discounts, { version: Version }));
                    if (before === after) {
                        console.warn('Unnecessary update of registration discounts', registrationId, before);
                    }
                }

                await registration.save();
                return true;
            });
        });
    },

    async deactivate(registration: Registration, _group?: Group, _member?: Member) {
        if (registration.deactivatedAt !== null) {
            return;
        }

        // Clear the registration
        registration.deactivatedAt = new Date();
        await registration.save();
        RegistrationService.scheduleStockUpdate(registration.id);

        await PlatformMembershipService.updateMembershipsForId(registration.memberId);

        await Document.deleteForRegistrations([registration]);
    },

    /**
     * Adds or removes the order to the stock of the webshop (if it wasn't already included). If amounts were changed, only those
     * changes will get added
     * Should always happen in the webshop-stock queue to prevent multiple webshop writes at the same time
     * + in combination with validation and reading the webshop
     */
    scheduleStockUpdate(id: string) {
        QueueHandler.cancel('registration-stock-update-' + id);

        AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            await QueueHandler.schedule('registration-stock-update-' + id, async function (this: undefined) {
                const updated = await Registration.getByID(id);

                if (!updated) {
                    return;
                }

                // Start with clearing all the stock reservations we've already made
                if (updated.stockReservations) {
                    const groupIds = Formatter.uniqueArray(updated.stockReservations.flatMap(r => r.objectType === 'Group' ? [r.objectId] : []));
                    for (const groupId of groupIds) {
                        const stocks = StockReservation.filter('Group', groupId, updated.stockReservations);

                        // Technically we don't need to await this, but okay...
                        await Group.freeStockReservations(groupId, stocks);
                    }
                }

                if (updated.shouldIncludeStock()) {
                    const groupStockReservations: StockReservation[] = [
                    // Group level stock reservations (stored in the group)
                        StockReservation.create({
                            objectId: updated.groupPrice.id,
                            objectType: 'GroupPrice',
                            amount: 1,
                        }),
                        ...updated.options.map((o) => {
                            return StockReservation.create({
                                objectId: o.option.id,
                                objectType: 'GroupOption',
                                amount: o.amount,
                            });
                        }),
                    ];

                    await Group.applyStockReservations(updated.groupId, groupStockReservations);

                    updated.stockReservations = [
                    // Global level stock reservations (stored in each group)
                        StockReservation.create({
                            objectId: updated.groupId,
                            objectType: 'Group',
                            amount: 1,
                            children: groupStockReservations,
                        }),
                    ];
                    await updated.save();
                }
                else {
                    if (updated.stockReservations.length) {
                        updated.stockReservations = [];
                        await updated.save();
                    }
                }
            });
        }).catch(console.error);
    },
};
