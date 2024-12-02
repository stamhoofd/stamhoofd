import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Document, Group, Member, Registration } from '@stamhoofd/models';
import { AuditLogSource, EmailTemplateType, StockReservation } from '@stamhoofd/structures';
import { AuditLogService } from './AuditLogService';
import { GroupService } from './GroupService';
import { PlatformMembershipService } from './PlatformMembershipService';
import { QueueHandler } from '@stamhoofd/queues';
import { Formatter } from '@stamhoofd/utility';

export const RegistrationService = {
    async markValid(registrationId: string) {
        const registration = await Registration.getByID(registrationId);
        if (!registration) {
            throw new Error('Registration not found');
        }

        if (registration.registeredAt !== null && registration.deactivatedAt === null) {
            return false;
        }

        registration.reservedUntil = null;
        registration.registeredAt = registration.registeredAt ?? new Date();
        registration.deactivatedAt = null;
        registration.canRegister = false;
        await registration.save();
        RegistrationService.scheduleStockUpdate(registration.id);

        await PlatformMembershipService.updateMembershipsForId(registration.memberId);

        await registration.sendEmailTemplate({
            type: EmailTemplateType.RegistrationConfirmation,
        });

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

    async deactivate(registration: Registration, _group?: Group, _member?: Member) {
        if (registration.deactivatedAt !== null) {
            return;
        }

        // Clear the registration
        registration.deactivatedAt = new Date();
        await registration.save();
        RegistrationService.scheduleStockUpdate(registration.id);

        await PlatformMembershipService.updateMembershipsForId(registration.memberId);
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
