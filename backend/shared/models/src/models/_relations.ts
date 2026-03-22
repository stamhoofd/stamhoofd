/**
 * Defining these relations are not super handy because they cause circular references.
 * That is why they are mvoed to a separate file after the classes are defined
 *
 * This is a deprecated pattern and we should avoid creating new relations directly for now.
 */

import { ManyToOneRelation } from '@simonbackx/simple-database';
import { Order } from './Order.js';
import { Organization } from './Organization.js';
import { STPendingInvoice } from './STPendingInvoice.js';
import { Ticket } from './Ticket.js';
import { User } from './User.js';
import { UserPermissions } from './UserPermissions.js';
import { Webshop } from './Webshop.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';
import { Invoice } from './Invoice.js';
import { BalanceItem } from './BalanceItem.js';
import { BalanceItemPayment } from './BalanceItemPayment.js';
import { Payment } from './Payment.js';
import { Group } from './Group.js';
import { Registration } from './Registration.js';
import { Token } from './Token.js';
import { PasswordToken } from './PasswordToken.js';

if (User === undefined) {
    throw new Error('Unexpected missing User');
}

if (!Ticket.relations) {
    Ticket.relations = [];
}

// Ticket
Ticket.webshop = new ManyToOneRelation(Webshop, 'webshop');
Ticket.webshop.foreignKey = 'webshopId';
Ticket.relations.push(Ticket.webshop);

Ticket.order = new ManyToOneRelation(Order, 'order');
Ticket.order.foreignKey = 'orderId';
Ticket.relations.push(Ticket.order);

Ticket.organization = new ManyToOneRelation(Organization, 'organization');
Ticket.organization.foreignKey = 'organizationId';
Ticket.relations.push(Ticket.organization);

if (!STPendingInvoice.relations) {
    STPendingInvoice.relations = [];
}

STPendingInvoice.organization = new ManyToOneRelation(Organization, 'organization');
STPendingInvoice.organization.foreignKey = 'organizationId';
STPendingInvoice.relations.push(STPendingInvoice.organization);

if (!Order.relations) {
    Order.relations = [];
}

Order.organization = new ManyToOneRelation(Organization, 'organization');
Order.organization.foreignKey = 'organizationId';
Order.relations.push(Order.organization);

Order.webshop = new ManyToOneRelation(Webshop, 'webshop');
Order.webshop.foreignKey = 'webshopId';
Order.relations.push(Order.webshop);

Order.payment = new ManyToOneRelation(Payment, 'payment');
Order.payment.foreignKey = 'paymentId';
Order.relations.push(Order.payment);

if (!Webshop.relations) {
    Webshop.relations = [];
}

Webshop.organization = new ManyToOneRelation(Organization, 'organization');
Webshop.organization.foreignKey = 'organizationId';
Webshop.relations.push(Webshop.organization);

// UserPermissions

if (!UserPermissions.relations) {
    UserPermissions.relations = [];
}
UserPermissions.organization = new ManyToOneRelation(Organization, 'organization');
UserPermissions.organization.foreignKey = 'organizationId';
UserPermissions.relations.push(UserPermissions.organization);

UserPermissions.user = new ManyToOneRelation(User, 'user');
UserPermissions.user.foreignKey = 'userId';
UserPermissions.relations.push(UserPermissions.user);

if (!InvoicedBalanceItem.relations) {
    InvoicedBalanceItem.relations = [];
}
InvoicedBalanceItem.invoice = new ManyToOneRelation(Invoice, 'invoice');
InvoicedBalanceItem.invoice.foreignKey = 'invoiceId';
InvoicedBalanceItem.relations.push(InvoicedBalanceItem.invoice);

InvoicedBalanceItem.balanceItem = new ManyToOneRelation(BalanceItem, 'balanceItem');
InvoicedBalanceItem.balanceItem.foreignKey = 'balanceItemId';
InvoicedBalanceItem.relations.push(InvoicedBalanceItem.balanceItem);

if (!BalanceItemPayment.relations) {
    BalanceItemPayment.relations = [];
}
BalanceItemPayment.balanceItem = new ManyToOneRelation(BalanceItem, 'balanceItem');
BalanceItemPayment.balanceItem.foreignKey = 'balanceItemId';
BalanceItemPayment.relations.push(BalanceItemPayment.balanceItem);

BalanceItemPayment.payment = new ManyToOneRelation(Payment, 'payment');
BalanceItemPayment.payment.foreignKey = 'paymentId';
BalanceItemPayment.relations.push(BalanceItemPayment.payment);

if (!Registration.relations) {
    Registration.relations = [];
}
Registration.group = new ManyToOneRelation(Group, 'group');
Registration.group.foreignKey = 'groupId';
Registration.relations.push(Registration.group);

if (!Token.relations) {
    Token.relations = [];
}
Token.user = new ManyToOneRelation(User, 'user');
Token.user.foreignKey = 'userId';
Token.relations.push(Token.user);

if (!PasswordToken.relations) {
    PasswordToken.relations = [];
}
PasswordToken.user = new ManyToOneRelation(User, 'user');
PasswordToken.user.foreignKey = 'userId';
PasswordToken.relations.push(PasswordToken.user);
