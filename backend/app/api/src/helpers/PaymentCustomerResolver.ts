import { PaymentCustomer } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { BalanceItem, Member, Order, Organization, Payment, User } from '@stamhoofd/models';

/**
 * The related models that are needed to determine the customer of a payment on a best-effort basis.
 */
export type PaymentCustomerRelations = {
    /**
     * The balance items linked to the payment (via balance item payments).
     */
    balanceItems: BalanceItem[];
    members: Member[];
    users: User[];
    orders: Order[];
    payingOrganizations: Organization[];
};

/**
 * Determines the customer that paid a payment on a best-effort basis.
 *
 * In our v1 code payments had no customer. To fill in the missing data we try to figure out who paid
 * by inspecting the balance items linked to the payment and their related members, users and orders, in
 * addition to the paying organization/user stored directly on the payment.
 *
 * Priority (most reliable source first):
 * 1. The paying organization (payingOrganizationId) → company customer
 * 2. The paying user (payingUserId)
 * 3. A member linked to one of the balance items
 * 4. A user linked to one of the balance items
 * 5. The customer of an order linked to one of the balance items
 *
 * Returns null when we could not find any usable information.
 */
export function determinePaymentCustomer(payment: Payment, relations: PaymentCustomerRelations): PaymentCustomer | null {
    const { balanceItems, members, users, orders, payingOrganizations } = relations;

    // 1. Paid by an organization
    if (payment.payingOrganizationId) {
        const organization = payingOrganizations.find(o => o.id === payment.payingOrganizationId);
        if (organization) {
            return PaymentCustomer.create({
                company: organization.defaultCompanies[0] ?? null,
            });
        }
    }

    // 2. Paid by a known user
    if (payment.payingUserId) {
        const user = users.find(u => u.id === payment.payingUserId);
        const customer = user ? customerFromUser(user) : null;
        if (customer) {
            return customer;
        }
    }

    // The balance items linked to this payment, used to find members/users/orders.
    const linkedMemberIds = Formatter.uniqueArray(balanceItems.map(b => b.memberId).filter((id): id is string => id !== null));
    const linkedUserIds = Formatter.uniqueArray(balanceItems.map(b => b.userId).filter((id): id is string => id !== null));
    const linkedOrderIds = Formatter.uniqueArray(balanceItems.map(b => b.orderId).filter((id): id is string => id !== null));
    const linkedPayingOrganizationIds = Formatter.uniqueArray(balanceItems.map(b => b.payingOrganizationId).filter((id): id is string => id !== null));

    // 3. A member linked to the balance items
    for (const memberId of linkedMemberIds) {
        const member = members.find(m => m.id === memberId);
        if (member) {
            const customer = customerFromMember(member);
            if (customer) {
                return customer;
            }
        }
    }

    // 4. A user linked to the balance items
    for (const userId of linkedUserIds) {
        const user = users.find(u => u.id === userId);
        if (user) {
            const customer = customerFromUser(user);
            if (customer) {
                return customer;
            }
        }
    }

    // 5. The customer data of an order linked to the balance items
    for (const orderId of linkedOrderIds) {
        const order = orders.find(o => o.id === orderId);
        if (order && (order.data.customer.email || order.data.customer.name)) {
            return order.data.customer.toPaymentCustomer();
        }
    }

    // 6. A paying organization referenced by a balance item (fallback)
    for (const organizationId of linkedPayingOrganizationIds) {
        const organization = payingOrganizations.find(o => o.id === organizationId);
        if (organization) {
            return PaymentCustomer.create({
                company: organization.defaultCompanies[0] ?? null,
            });
        }
    }

    return null;
}

function customerFromUser(user: User): PaymentCustomer | null {
    if (!user.firstName && !user.lastName && !user.email) {
        return null;
    }
    return PaymentCustomer.create({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
    });
}

function customerFromMember(member: Member): PaymentCustomer | null {
    const details = member.details;

    // For young members the parents are the ones who pay, mirroring the logic used elsewhere
    // (e.g. ReceivableBalance customers).
    const useParents = (details.calculatedParentsHaveAccess || details.getMemberEmails().length === 0) && details.parents.length > 0;

    if (useParents) {
        const parent = details.parents[0];
        return PaymentCustomer.create({
            firstName: parent.firstName ?? null,
            lastName: parent.lastName ?? null,
            email: parent.getEmails()[0] ?? null,
            phone: parent.phone,
        });
    }

    if (!details.firstName && !details.lastName && details.getMemberEmails().length === 0) {
        return null;
    }

    return PaymentCustomer.create({
        firstName: details.firstName ?? null,
        lastName: details.lastName ?? null,
        email: details.getMemberEmails()[0] ?? null,
        phone: details.phone,
    });
}
