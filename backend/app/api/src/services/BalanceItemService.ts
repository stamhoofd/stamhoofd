import { Model } from '@simonbackx/simple-database';
import { BalanceItem, CachedBalance, Document, MemberUser, Order, Organization, Payment, Webshop } from '@stamhoofd/models';
import { AuditLogSource, BalanceItemStatus, BalanceItemType, OrderStatus, PaymentStatus, ReceivableBalanceType } from '@stamhoofd/structures';
import { GroupedThrottledQueue } from '../helpers/GroupedThrottledQueue';
import { ThrottledQueue } from '../helpers/ThrottledQueue';
import { AuditLogService } from './AuditLogService';
import { PaymentReallocationService } from './PaymentReallocationService';
import { RegistrationService } from './RegistrationService';

const memberUpdateQueue = new GroupedThrottledQueue(async (organizationId: string, memberIds: string[]) => {
    await CachedBalance.updateForMembers(organizationId, memberIds);

    for (const memberId of memberIds) {
        await PaymentReallocationService.reallocate(organizationId, memberId, ReceivableBalanceType.member);
    }

    if (memberIds.length) {
        // Now also include the userIds of the members
        const userMemberIds = (await MemberUser.select().where('membersId', memberIds).fetch()).map(m => m.usersId);
        userUpdateQueue.addItems(organizationId, userMemberIds);
    }
}, { maxDelay: 10_000 });

const userUpdateQueue = new GroupedThrottledQueue(async (organizationId: string, userIds: string[]) => {
    await CachedBalance.updateForUsers(organizationId, userIds);

    for (const userId of userIds) {
        await PaymentReallocationService.reallocate(organizationId, userId, ReceivableBalanceType.user);
    }
}, { maxDelay: 10_000 });

const organizationUpdateQueue = new GroupedThrottledQueue(async (organizationId: string, organizationIds: string[]) => {
    await CachedBalance.updateForOrganizations(organizationId, organizationIds);

    for (const payingOrganizationId of organizationIds) {
        await PaymentReallocationService.reallocate(organizationId, payingOrganizationId, ReceivableBalanceType.organization);
    }
}, { maxDelay: 60_000 });

export const registrationUpdateQueue = new GroupedThrottledQueue(async (organizationId: string, registrationIds: string[]) => {
    await CachedBalance.updateForRegistrations(organizationId, registrationIds);
    await Document.updateForRegistrations(registrationIds, organizationId);
}, { maxDelay: 10_000 });

const bundleDiscountsUpdateQueue = new ThrottledQueue(async (registrationIds: string[]) => {
    for (const registrationId of registrationIds) {
        await RegistrationService.updateDiscounts(registrationId);
    }
}, { maxDelay: 10_000 });

export const BalanceItemService = {
    listening: false,

    listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            if (!(event.model instanceof BalanceItem)) {
                return;
            }

            if (event.type === 'created' || event.type === 'deleted') {
                await this.scheduleUpdate(event.model);
                return;
            }

            // Check changed:
            // status, unitPrice, dueAt, amount
            if (
                'status' in event.changedFields
                || 'dueAt' in event.changedFields
                || 'priceTotal' in event.changedFields
                || 'memberId' in event.changedFields
                || 'userId' in event.changedFields
                || 'payingOrganizationId' in event.changedFields
                || 'registrationId' in event.changedFields
            ) {
                await this.scheduleUpdate(event.model);
            }
        });
    },

    /**
     * Schedule an update for the balance item:
     * - Updates cached outstanding balances for members, users, organizations and registrations
     *
     * Does not execute the update immediately, but schedules it to be run in the background.
     */
    async scheduleUpdate(item: BalanceItem) {
        await this.scheduleUpdates([item]);

        // Todo: optimize
        if (item.type === BalanceItemType.RegistrationBundleDiscount) {
            // Save the applied discount to the related registration
            if (item.registrationId) {
                bundleDiscountsUpdateQueue.addItem(item.registrationId);
            }
        }
    },

    /**
     * Call this when a payment or payment balance items have changed.
     * It will also call updateOutstanding automatically, so no need to call that separately again
     */
    async updatePaidAndPending(items: BalanceItem[]) {
        console.log('updatePaidAndPending for', items.length, 'items');
        await BalanceItem.updatePricePaid(items.map(i => i.id));
        await this.scheduleUpdates(items);
    },

    /**
     * In some situations we need immediate updates
     */
    async flushRegistrationDiscountsCache() {
        await bundleDiscountsUpdateQueue.flushAndWait();
    },

    /**
     * Make sure all the pending changes for cached balances are run
     */
    async flushCaches(organizationId: string) {
        await memberUpdateQueue.flushGroupAndWait(organizationId);
        await userUpdateQueue.flushGroupAndWait(organizationId);
        await organizationUpdateQueue.flushGroupAndWait(organizationId);
        await registrationUpdateQueue.flushGroupAndWait(organizationId);
        await bundleDiscountsUpdateQueue.flushAndWait();
    },

    async flushAll() {
        await memberUpdateQueue.flushAndWait();
        await userUpdateQueue.flushAndWait();
        await organizationUpdateQueue.flushAndWait();
        await registrationUpdateQueue.flushAndWait();
        await bundleDiscountsUpdateQueue.flushAndWait();
    },

    /**
     * Update how many every object in the system owes or needs to be reimbursed
     * and also updates the pricePaid/pricePending cached values in Balance items and members
     */
    async scheduleUpdates(items: BalanceItem[]) {
        console.log('Schedule outstanding balance for', items.length, 'items');

        for (const item of items) {
            if (item.memberId) {
                memberUpdateQueue.addItem(item.organizationId, item.memberId);
            }

            if (item.userId) {
                userUpdateQueue.addItem(item.organizationId, item.userId);
            }

            if (item.payingOrganizationId) {
                organizationUpdateQueue.addItem(item.organizationId, item.payingOrganizationId);
            }

            if (item.registrationId) {
                registrationUpdateQueue.addItem(item.organizationId, item.registrationId);
            }
        }
    },

    scheduleUserUpdate(organizationId: string, userId: string) {
        userUpdateQueue.addItem(organizationId, userId);
    },

    scheduleMemberUpdate(organizationId: string, memberId: string) {
        memberUpdateQueue.addItem(organizationId, memberId);
    },

    scheduleOrganizationUpdate(organizationId: string, payingOrganizationId: string) {
        organizationUpdateQueue.addItem(organizationId, payingOrganizationId);
    },

    async markDue(balanceItem: BalanceItem) {
        if (balanceItem.status === BalanceItemStatus.Hidden) {
            balanceItem.status = BalanceItemStatus.Due;
            await balanceItem.save();
        }

        // status and pricePaid changes are handled inside balanceitempayment
        if (balanceItem.dependingBalanceItemId) {
            const depending = await BalanceItem.getByID(balanceItem.dependingBalanceItemId);
            if (depending && depending.status === BalanceItemStatus.Hidden) {
                depending.status = BalanceItemStatus.Due;
                await balanceItem.save();
            }
        }
    },

    async markPaid(balanceItem: BalanceItem, payment: Payment | null, organization: Organization) {
        await this.markDue(balanceItem);
        let shouldMarkUpdated = true;

        // For orders, we should always call markPaid on the order - it is safe to call this multiple times
        // we need to call it multiple times, in case the order was previously marked unpaid, and then paid again - then we'll need to recreate the tickets
        if (balanceItem.orderId) {
            const order = await Order.getByID(balanceItem.orderId);
            if (order) {
                shouldMarkUpdated = false;
                await order.markPaid(payment, organization);

                // Save number in balance description
                if (order.number !== null) {
                    const webshop = await Webshop.getByID(order.webshopId);

                    if (webshop) {
                        balanceItem.description = order.generateBalanceDescription(webshop);
                        await balanceItem.save();
                    }
                }
            }
        }

        if (balanceItem.paidAt) {
            // Already ran side effects
            // If we for example deleted a related order or registration - and we still have the balance item, mark it as paid again, we don't want to reactivate the order or registration
            if (shouldMarkUpdated) {
                await this.markUpdated(balanceItem, payment, organization);
            }

            if (balanceItem.registrationId) {
                if (balanceItem.type === BalanceItemType.Registration && !!payment && payment.status === PaymentStatus.Succeeded) {
                    await RegistrationService.markRepeatedPaid(balanceItem.registrationId);
                }
            }
            return;
        }

        // It is possible this balance item was earlier paid
        // and later the regigstration / order has been canceled and it became a negative balance item - which as some point has been reembursed and marked as 'paid'
        // in that case, we should be careful not to mark the registration as valid again

        // If registration
        if (balanceItem.registrationId) {
            if (balanceItem.type === BalanceItemType.Registration) {
                await RegistrationService.markValid(balanceItem.registrationId, { paid: !!payment && payment.status === PaymentStatus.Succeeded });
            }
        }

        balanceItem.paidAt = new Date();
        await balanceItem.save();
    },

    async markUpdated(balanceItem: BalanceItem, payment: Payment | null, organization: Organization) {
        // For orders: mark order as changed (so they are refetched in front ends)
        if (balanceItem.orderId) {
            await AuditLogService.setContext({ source: AuditLogSource.Payment }, async () => {
                if (balanceItem.orderId) {
                    const order = await Order.getByID(balanceItem.orderId);
                    if (order) {
                        await order.paymentChanged(payment, organization);
                    }
                }
            });
        }
    },

    async undoPaid(balanceItem: BalanceItem, payment: Payment | null, organization: Organization) {
        // If order
        if (balanceItem.orderId) {
            const order = await Order.getByID(balanceItem.orderId);
            if (order) {
                // This is safe to run multiple times. Doesn't have side effects
                await order.undoPaid(payment, organization);
            }
        }
    },

    async markFailed(balanceItem: BalanceItem, payment: Payment, organization: Organization) {
        // If order
        if (balanceItem.orderId) {
            const order = await Order.getByID(balanceItem.orderId);
            if (order) {
                await order.onPaymentFailed(payment, organization);

                if (order.status === OrderStatus.Deleted) {
                    balanceItem.status = BalanceItemStatus.Hidden;
                    await balanceItem.save();
                }
            }
        }
    },

    async undoFailed(balanceItem: BalanceItem, payment: Payment, organization: Organization) {
        // If order
        if (balanceItem.orderId) {
            const order = await Order.getByID(balanceItem.orderId);
            if (order) {
                await order.undoPaymentFailed(payment, organization);
            }
        }
    },
};
