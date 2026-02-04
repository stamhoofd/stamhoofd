import { Email, Member, MemberResponsibilityRecord, Order, Organization, User } from '@stamhoofd/models';
import { compileToSQLFilter } from '@stamhoofd/sql';
import { EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, Replacement, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { memberResponsibilityRecordFilterCompilers } from '../sql-filters/member-responsibility-records.js';

async function getRecipients(result: PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>, type: EmailRecipientFilterType.Payment | EmailRecipientFilterType.PaymentOrganization, subFilter: StamhoofdFilter | null) {
    const recipients: EmailRecipient[] = [];
    const userIds: { userId: string; payment: PaymentGeneral }[] = [];
    const organizationIds: { organizationId: string; payment: PaymentGeneral }[] = [];
    const memberIds: { memberId: string; payment: PaymentGeneral }[] = [];
    const orderIds: { orderId: string; payment: PaymentGeneral }[] = [];

    for (const payment of result.results) {
        if (payment.payingOrganizationId) {
            organizationIds.push({ organizationId: payment.payingOrganizationId, payment });
            continue;
        }

        if (payment.payingUserId) {
            userIds.push({ userId: payment.payingUserId, payment });
            continue;
        }

        const balanceItemOrganizationIds = new Set<string>();
        const balanceItemUserIds = new Set<string>();
        const balanceItemMemberIds = new Set<string>();
        const balanceItemOrderIds = new Set<string>();

        for (const balanceItemPayment of payment.balanceItemPayments) {
            const balanceItem = balanceItemPayment.balanceItem;

            if (balanceItem.payingOrganizationId) {
                balanceItemOrganizationIds.add(balanceItem.payingOrganizationId);
                continue;
            }

            if (balanceItem.userId) {
                balanceItemUserIds.add(balanceItem.userId);
                continue;
            }

            if (balanceItem.memberId) {
                balanceItemMemberIds.add(balanceItem.memberId);
                continue;
            }

            if (balanceItem.orderId) {
                balanceItemOrderIds.add(balanceItem.orderId);
                continue;
            }
        }

        const totalRecipientsForPayment = balanceItemOrganizationIds.size + balanceItemUserIds.size + balanceItemMemberIds.size + balanceItemOrderIds.size;
        if (totalRecipientsForPayment > 1) {
            console.warn('Multiple recipients found for payment: ', payment.id);
        }

        if (balanceItemOrganizationIds.size > 0) {
            organizationIds.push(...Array.from(balanceItemOrganizationIds).map(organizationId => ({ organizationId, payment })));
        }
        if (balanceItemUserIds.size > 0) {
            userIds.push(...Array.from(balanceItemUserIds).map(userId => ({ userId, payment })));
        }
        if (balanceItemMemberIds.size > 0) {
            memberIds.push(...Array.from(balanceItemMemberIds).map(memberId => ({ memberId, payment })));
        }
        if (balanceItemOrderIds.size > 0) {
            orderIds.push(...Array.from(balanceItemOrderIds).map(orderId => ({ orderId, payment })));
        }
    }

    if (type === EmailRecipientFilterType.Payment) {
        recipients.push(...await getUserRecipients(userIds));
        recipients.push(...await getMemberRecipients(memberIds));
        recipients.push(...await getUserRecipients(userIds));
        recipients.push(...await getOrderRecipients(orderIds));
    }
    else {
        recipients.push(...await getOrganizationRecipients(organizationIds, subFilter));
    }

    return recipients;
}

async function getUserRecipients(ids: { userId: string; payment: PaymentGeneral }[]): Promise<EmailRecipient[]> {
    if (ids.length === 0) {
        return [];
    }

    const allUserIds = Formatter.uniqueArray(ids.map(i => i.userId));
    const users = await User.getByIDs(...allUserIds);

    const results: EmailRecipient[] = [];

    for (const { userId, payment } of ids) {
        const user = users.find(u => u.id === userId);

        if (user) {
            results.push(EmailRecipient.create({
                objectId: payment.id,
                userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                replacements: getEmailReplacementsForPayment(payment),
            }));
        }
    }

    return results;
}

async function getMembersForOrganizations(organizationIds: string[], filter: StamhoofdFilter | null): Promise<Map<string, Member[]>> {
    const query = MemberResponsibilityRecord.select()
        .where('organizationId', organizationIds)
        .where('endDate', null)
        .where(await compileToSQLFilter(filter,
            memberResponsibilityRecordFilterCompilers));

    const responsibilites = await query
        .fetch();

    const allMemberIds = Formatter.uniqueArray(responsibilites.map(r => r.memberId));
    const members = await Member.getByIDs(...allMemberIds);

    const result = new Map<string, Member[]>();

    for (const responsibility of responsibilites) {
        const organizationId = responsibility.organizationId;

        if (!organizationId) {
            continue;
        }

        const member = members.find(m => m.id === responsibility.memberId);

        if (!member) {
            continue;
        }

        const membersForOrganization = result.get(organizationId);
        if (membersForOrganization) {
            membersForOrganization.push(member);
        }
        else {
            result.set(organizationId, [member]);
        }
    }

    return result;
}

async function getOrganizationRecipients(ids: { organizationId: string; payment: PaymentGeneral }[], subFilter: StamhoofdFilter | null): Promise<EmailRecipient[]> {
    if (ids.length === 0 || subFilter === null) {
        return [];
    }

    const allOrganizationIds = Formatter.uniqueArray(ids.map(i => i.organizationId));
    const organizations = await Organization.getByIDs(...allOrganizationIds);
    if (!organizations.length) {
        return [];
    }

    const membersForOrganizations = await getMembersForOrganizations(allOrganizationIds, subFilter);

    const results: EmailRecipient[] = [];

    for (const { organizationId, payment } of ids) {
        const organization = organizations.find(o => o.id === organizationId);

        if (organization) {
            const members = membersForOrganizations.get(organizationId);
            if (!members) {
                continue;
            }

            const replacements = getEmailReplacementsForPayment(payment);

            for (const member of members) {
                for (const email of member.details.getMemberEmails()) {
                    results.push(EmailRecipient.create({
                        objectId: payment.id,
                        name: organization.name,
                        memberId: member.id,
                        firstName: member.details.firstName,
                        lastName: member.details.lastName,
                        email,
                        replacements,
                    }));
                }
            }
        }
    }

    return results;
}

async function getMemberRecipients(ids: { memberId: string; payment: PaymentGeneral }[]): Promise<EmailRecipient[]> {
    if (ids.length === 0) {
        return [];
    }

    const allMemberIds = Formatter.uniqueArray(ids.map(i => i.memberId));
    const members = await Member.getBlobByIds(...allMemberIds);

    const results: EmailRecipient[] = [];

    for (const { memberId, payment } of ids) {
        const member = members.find(m => m.id === memberId);

        if (member) {
            const emails = member.details.getNotificationEmails();

            for (const user of member.users) {
                if (!emails.includes(user.email.toLocaleLowerCase())) {
                    continue;
                }

                const recipient = EmailRecipient.create({
                    objectId: payment.id,
                    userId: user.id,
                    memberId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    replacements: getEmailReplacementsForPayment(payment),
                });
                results.push(recipient);
            }
        }
    }

    return results;
}

async function getOrderRecipients(ids: { orderId: string; payment: PaymentGeneral }[]): Promise<EmailRecipient[]> {
    if (ids.length === 0) {
        return [];
    }

    const allOrderIds = Formatter.uniqueArray(ids.map(i => i.orderId));
    const orders = await Order.getByIDs(...allOrderIds);

    const results: EmailRecipient[] = [];

    for (const { orderId, payment } of ids) {
        const order = orders.find(o => o.id === orderId);

        if (order) {
            const { firstName, lastName, email } = order.data.customer;

            results.push(EmailRecipient.create({
                objectId: payment.id,
                userId: order.userId,
                firstName,
                lastName,
                email,
                replacements: getEmailReplacementsForPayment(payment),
            }));
        }
    }

    return results;
}

function getEmailReplacementsForPayment(payment: PaymentGeneral): Replacement[] {
    // todo
    return [];
}

async function fetchPaymentRecipients(query: LimitedFilteredRequest) {
    const result = await GetPaymentsEndpoint.buildData(query);

    return new PaginatedResponse({
        results: await getRecipients(result, EmailRecipientFilterType.Payment, null),
        next: result.next,
    });
}

Email.recipientLoaders.set(EmailRecipientFilterType.Payment, {
    fetch: fetchPaymentRecipients,
    // For now: only count the number of payments - not the amount of emails
    count: async (query: LimitedFilteredRequest) => {
        const q = await GetPaymentsEndpoint.buildQuery(query);
        const base = await q.count();

        if (base < 1000) {
            // Do full scan
            query.limit = 1000;
            const result = await fetchPaymentRecipients(query);
            return result.results.length;
        }

        return base;
    },
});

async function fetchPaymentOrganizationRecipients(query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) {
    const result = await GetPaymentsEndpoint.buildData(query);

    return new PaginatedResponse({
        results: await getRecipients(result, EmailRecipientFilterType.PaymentOrganization, subfilter),
        next: result.next,
    });
}

Email.recipientLoaders.set(EmailRecipientFilterType.PaymentOrganization, {
    fetch: fetchPaymentOrganizationRecipients,
    // For now: only count the number of payments - not the amount of emails
    count: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => {
        const q = await GetPaymentsEndpoint.buildQuery(query);
        const base = await q.count();

        if (base < 1000) {
            // Do full scan
            query.limit = 1000;
            const result = await fetchPaymentOrganizationRecipients(query, subfilter);
            return result.results.length;
        }

        return base;
    },
});
