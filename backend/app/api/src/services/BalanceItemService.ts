import { BalanceItem, Order, Organization, Payment, Webshop } from '@stamhoofd/models';
import { AuditLogSource, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, OrderStatus, ReceivableBalanceType } from '@stamhoofd/structures';
import { AuditLogService } from './AuditLogService';
import { RegistrationService } from './RegistrationService';
import { PaymentReallocationService } from './PaymentReallocationService';
import { Formatter } from '@stamhoofd/utility';

export const BalanceItemService = {
    async markDue(balanceItem: BalanceItem) {
        const reactivate: BalanceItem[] = [];
        if (balanceItem.status === BalanceItemStatus.Hidden) {
            reactivate.push(balanceItem);
        }

        // status and pricePaid changes are handled inside balanceitempayment
        if (balanceItem.dependingBalanceItemId) {
            const depending = await BalanceItem.getByID(balanceItem.dependingBalanceItemId);
            if (depending && depending.status === BalanceItemStatus.Hidden) {
                reactivate.push(depending);
            }
        }

        if (reactivate.length > 0) {
            await BalanceItem.reactivateItems(reactivate);

            if (balanceItem.type === BalanceItemType.RegistrationBundleDiscount) {
                // Save the applied discount to the related registration
                if (balanceItem.registrationId) {
                    await RegistrationService.updateDiscounts(balanceItem.registrationId);
                }
            }
        }
    },

    async markPaid(balanceItem: BalanceItem, payment: Payment | null, organization: Organization) {
        await this.markDue(balanceItem);

        if (balanceItem.paidAt) {
            // Already ran side effects
            // If we for example deleted a related order or registration - and we still have the balance item, mark it as paid again, we don't want to reactivate the order or registration
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
