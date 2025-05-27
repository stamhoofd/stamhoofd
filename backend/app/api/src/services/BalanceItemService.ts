import { BalanceItem, CachedBalance, Document, MemberUser, Order, Organization, Payment, Webshop } from '@stamhoofd/models';
import { AuditLogSource, BalanceItemStatus, BalanceItemType, OrderStatus, ReceivableBalanceType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AuditLogService } from './AuditLogService';
import { PaymentReallocationService } from './PaymentReallocationService';
import { RegistrationService } from './RegistrationService';
import { Model } from '@simonbackx/simple-database';

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
                || 'unitPrice' in event.changedFields
                || 'dueAt' in event.changedFields
                || 'amount' in event.changedFields
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
     * Todo: actually schedule the update and auto-flush on the next BalanceItem selection
     */
    async scheduleUpdate(item: BalanceItem) {
        await this.updateOutstanding([item]);

        // Todo: optimize
        if (item.type === BalanceItemType.RegistrationBundleDiscount) {
            // Save the applied discount to the related registration
            if (item.registrationId) {
                await RegistrationService.updateDiscounts(item.registrationId);
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
        await this.updateOutstanding(items);
    },

    /**
     * Update how many every object in the system owes or needs to be reimbursed
     * and also updates the pricePaid/pricePending cached values in Balance items and members
     */
    async updateOutstanding(items: BalanceItem[], additionalItems: { memberId: string; organizationId: string }[] = []) {
        console.log('Update outstanding balance for', items.length, 'items');

        const organizationIds = Formatter.uniqueArray(items.map(p => p.organizationId));
        for (const organizationId of organizationIds) {
            const filteredItems = items.filter(i => i.organizationId === organizationId);
            const filteredAdditionalItems = additionalItems.filter(i => i.organizationId === organizationId);

            const memberIds = Formatter.uniqueArray(
                [
                    ...filteredItems.map(p => p.memberId).filter(id => id !== null),
                    ...filteredAdditionalItems.map(i => i.memberId),
                ],
            );

            await CachedBalance.updateForMembers(organizationId, memberIds);

            let userIds = filteredItems.filter(p => p.userId !== null).map(p => p.userId!);

            if (memberIds.length) {
                // Now also include the userIds of the members
                const userMemberIds = (await MemberUser.select().where('membersId', memberIds).fetch()).map(m => m.usersId);
                userIds.push(...userMemberIds);
            }
            userIds = Formatter.uniqueArray(userIds);

            await CachedBalance.updateForUsers(organizationId, userIds);

            const organizationIds = Formatter.uniqueArray(filteredItems.map(p => p.payingOrganizationId).filter(id => id !== null));
            await CachedBalance.updateForOrganizations(organizationId, organizationIds);

            const registrationIds: string[] = Formatter.uniqueArray(filteredItems.map(p => p.registrationId).filter(id => id !== null));
            await CachedBalance.updateForRegistrations(organizationId, registrationIds);

            if (registrationIds.length) {
                await Document.updateForRegistrations(registrationIds, organizationId);
            }
        }
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

        if (balanceItem.paidAt) {
            // Already ran side effects
            // If we for example deleted a related order or registration - and we still have the balance item, mark it as paid again, we don't want to reactivate the order or registration
            await this.markUpdated(balanceItem, payment, organization);
            return;
        }

        // It is possible this balance item was earlier paid
        // and later the regigstration / order has been canceled and it became a negative balance item - which as some point has been reembursed and marked as 'paid'
        // in that case, we should be careful not to mark the registration as valid again

        // If registration
        if (balanceItem.registrationId) {
            if (balanceItem.type === BalanceItemType.Registration) {
                await RegistrationService.markValid(balanceItem.registrationId);
            }
        }

        // If order
        if (balanceItem.orderId) {
            const order = await Order.getByID(balanceItem.orderId);
            if (order) {
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

        balanceItem.paidAt = new Date();
        await balanceItem.save();
    },

    async reallocate(balanceItems: BalanceItem[], organizationId: string) {
        const memberIds = Formatter.uniqueArray(balanceItems.map(b => b.memberId).filter(b => b !== null));
        const payingOrganizationIds = Formatter.uniqueArray(balanceItems.map(b => b.payingOrganizationId).filter(b => b !== null));
        const userIds = Formatter.uniqueArray(balanceItems.map(b => b.userId).filter(b => b !== null));

        for (const memberId of memberIds) {
            await PaymentReallocationService.reallocate(organizationId, memberId, ReceivableBalanceType.member);
        }

        for (const payingOrganizationId of payingOrganizationIds) {
            await PaymentReallocationService.reallocate(organizationId, payingOrganizationId, ReceivableBalanceType.organization);
        }

        for (const userId of userIds) {
            await PaymentReallocationService.reallocate(organizationId, userId, ReceivableBalanceType.user);
        }
    },

    async markUpdated(balanceItem: BalanceItem, payment: Payment, organization: Organization) {
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
