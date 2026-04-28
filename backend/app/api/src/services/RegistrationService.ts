import { ManyToOneRelation } from '@simonbackx/simple-database';
import { encodeObject } from '@simonbackx/simple-encoding';
import { BalanceItem, Document, Group, Member, Organization, Registration, RegistrationInvitation, sendEmailTemplate } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AppliedRegistrationDiscount, AuditLogSource, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, EmailTemplateType, GroupType, Recipient, Replacement, StockReservation, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogService } from './AuditLogService.js';
import { GroupService } from './GroupService.js';
import { PlatformMembershipService } from './PlatformMembershipService.js';

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

        await this.handleWaitingListRegistrationAndInvitation(registration);

        await PlatformMembershipService.updateMembershipsForId(registration.memberId);

        if (registration.sendConfirmationEmail) {
            await RegistrationService.sendEmailTemplate(registration, {
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

    /**
     * Delete all the invitations for the group and member linked to the registration.
     * Will not throw if it fails.
     * @param registration 
     */
    async handleWaitingListRegistrationAndInvitation(registration: Registration): Promise<void> {
        const group = await Group.getByID(registration.groupId);

        if (!group || group.type === GroupType.WaitingList) {
            // skip if waiting list (waiting lists cannot have invitations)
            return;
        }

        // get invitation for this group and member (can only be 1)
        const invitation = await RegistrationInvitation.select()
            .where('groupId', registration.groupId)
            .andWhere('memberId', registration.memberId)
            .first(false);
        
        const waitingListIds = new Set<string>();

        if (group.waitingListId) {
            // we should check if the member is on the waiting list of this group
            waitingListIds.add(group.waitingListId);
        }

        if (invitation) {
            // delete the invitation
            try {
                await invitation.delete();
            } catch (e) {
                // an error should not stop other logic (impact of an error is low)
                console.error(e);
            }
        }

        // unsubscribe from waiting list
        if (group.waitingListId) {
            try {
                // get the registration for the waiting list (should only be 1)
                const waitingListRegistration = await Registration.select()
                    .where('groupId', group.waitingListId)
                    .where('memberId', registration.memberId)
                    .where('deactivatedAt', null)
                    .whereNot('registeredAt', null)
                    .first(false);
                
                if (waitingListRegistration) {
                    // unsubscribe for waiting list (waiting lists cannot have a price -> balance items should not be updated)
                    await RegistrationService.deactivate(waitingListRegistration);
                    await GroupService.updateOccupancy(group.waitingListId);
                }
            } catch (e) {
                // an error should not stop other logic (impact of an error is low)
                console.error(e);
            }
        }
    },

    async getRecipients(registration: Registration, organization: Organization, group: Group) {
        const member = await Member.getByIdWithUsers(registration.memberId);

        if (!member) {
            return [];
        }

        const allowedEmails = member.details.getNotificationEmails();

        return member.users.map(user => Recipient.create({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userId: user.id,
            replacements: [
                Replacement.create({
                    token: 'firstNameMember',
                    value: member.details.firstName,
                }),
                Replacement.create({
                    token: 'lastNameMember',
                    value: member.details.lastName,
                }),
                Replacement.create({
                    token: 'registerUrl',
                    value: 'https://' + organization.getHost(),
                }),
                Replacement.create({
                    token: 'groupName',
                    value: group.settings.name.toString(),
                }),
            ],
        })).filter(r => allowedEmails.includes(r.email.toLocaleLowerCase()));
    },

    async sendEmailTemplate(registration: Registration, data: {
        type: EmailTemplateType;
    }) {
        const group = await Group.getByID(registration.groupId);

        if (!group) {
            return;
        }

        const organization = await Organization.getByID(group.organizationId);
        if (!organization) {
            return;
        }

        const recipients = await RegistrationService.getRecipients(registration, organization, group);

        // Create e-mail builder
        await sendEmailTemplate(organization, {
            template: {
                type: data.type,
                group,
            },
            recipients,
            type: 'transactional',
        });
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
