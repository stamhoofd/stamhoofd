import { ManyToOneRelation } from '@simonbackx/simple-database';
import { BalanceItem } from '../models/BalanceItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';

export const balanceItemPaymentRelations = {
    balanceItem: new ManyToOneRelation(BalanceItem, 'balanceItem'),
    payment: new ManyToOneRelation(Payment, 'payment'),
};
balanceItemPaymentRelations.balanceItem.foreignKey = 'balanceItemId';
balanceItemPaymentRelations.payment.foreignKey = 'paymentId';

export const ticketOrderRelation = new ManyToOneRelation(Order, 'order');
ticketOrderRelation.foreignKey = 'orderId';
