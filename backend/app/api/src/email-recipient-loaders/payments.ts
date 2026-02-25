import { BalanceItem, BalanceItemPayment, Email, Member, MemberResponsibilityRecord, Order, Organization, Payment, RecipientLoader, User, Webshop } from '@stamhoofd/models';
import { compileToSQLFilter, SQL } from '@stamhoofd/sql';
import { CountFilteredRequest, EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, PaymentMethod, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { memberResponsibilityRecordFilterCompilers } from '../sql-filters/member-responsibility-records.js';
import { buildReplacementOptions, getEmailReplacementsForPayment, ReplacementsOptions } from '../email-replacements/getEmailReplacementsForPayment.js';

type BeforeFetchAllResult = {
    doesIncludePaymentWithoutOrders: boolean;
    areAllPaymentsTransfers: boolean;
};

async function fetchPaymentRecipients(query: LimitedFilteredRequest, subfilter: StamhoofdFilter, beforeFetchAllResult?: BeforeFetchAllResult) {
    const result = await GetPaymentsEndpoint.buildData(query);

    return new PaginatedResponse({
        results: await getRecipients(result, EmailRecipientFilterType.Payment, subfilter, beforeFetchAllResult),
        next: result.next,
    });
}

const paymentRecipientLoader: RecipientLoader<BeforeFetchAllResult> = {
    beforeFetchAll: async (query: LimitedFilteredRequest) => {
        const doesIncludePaymentWithoutOrders = await doesQueryIncludePaymentsWithoutOrder(query);
        const areAllPaymentsTransfers = await doesQueryIncludePaymentsOtherThanTransfers(query);

        return {
            doesIncludePaymentWithoutOrders,
            areAllPaymentsTransfers,
        };
    },
    fetch: fetchPaymentRecipients,
    // For now: only count the number of payments - not the amount of emails
    count: async (query: LimitedFilteredRequest, _subfilter) => {
        const q = await GetPaymentsEndpoint.buildQuery(query);
        const base = await q.count();

        if (base < 1000) {
            // Do full scan
            query.limit = 1000;
            const result = await fetchPaymentRecipients(query, _subfilter);
            return result.results.length;
        }

        return base;
    },
};

Email.recipientLoaders.set(EmailRecipientFilterType.Payment, paymentRecipientLoader);

async function doesQueryIncludePaymentsWithoutOrder(filterRequest: LimitedFilteredRequest) {
    // create count request (without limit and page filter)
    const countRequest = new CountFilteredRequest({
        filter: filterRequest.filter,
        search: filterRequest.search,
    });

    const baseQuery = await GetPaymentsEndpoint.buildQuery(countRequest);

    const balanceItemPaymentsJoin = SQL.innerJoin(BalanceItemPayment.table)
        .where(
            SQL.column(BalanceItemPayment.table, 'paymentId'),
            SQL.column(Payment.table, 'id'),
        );

    const balanceItemJoin = SQL.innerJoin(BalanceItem.table)
        .where(
            SQL.column(BalanceItem.table, 'id'),
            SQL.column(BalanceItemPayment.table, 'balanceItemId'),
        );

    // check if 1 payment without order
    const results = await baseQuery
        .join(balanceItemPaymentsJoin)
        .join(balanceItemJoin)
        // where no order
        .where(SQL.column(BalanceItem.table, 'orderId'), null)
        .limit(1)
        .count();

    return results > 0;
}

async function doesQueryIncludePaymentsOtherThanTransfers(filterRequest: LimitedFilteredRequest) {
    // create count request (without limit and page filter)
    const countRequest = new CountFilteredRequest({
        filter: filterRequest.filter,
        search: filterRequest.search,
    });

    const baseQuery = await GetPaymentsEndpoint.buildQuery(countRequest);

    // check if 1 payment with other method than transfer
    const results = await baseQuery
        // where method is not transfer
        .whereNot(SQL.column(Payment.table, 'method'), PaymentMethod.Transfer)
        .limit(1)
        .count();

    return results === 0;
}

async function fetchPaymentOrganizationRecipients(query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null, beforeFetchAllResult?: BeforeFetchAllResult) {
    const result = await GetPaymentsEndpoint.buildData(query);

    return new PaginatedResponse({
        results: await getRecipients(result, EmailRecipientFilterType.PaymentOrganization, subfilter, beforeFetchAllResult),
        next: result.next,
    });
}

const paymentOrganizationRecipientLoader: RecipientLoader<BeforeFetchAllResult> = {
    fetch: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null, beforeFetchAllResult) => fetchPaymentOrganizationRecipients(query, subfilter, beforeFetchAllResult),
    // For now: only count the number of payments - not the amount of emails
    count: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => {
        const q = await GetPaymentsEndpoint.buildQuery(query);
        return await q.count();
    },
};

Email.recipientLoaders.set(EmailRecipientFilterType.PaymentOrganization, paymentOrganizationRecipientLoader);

async function getRecipients(result: PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>, type: EmailRecipientFilterType.Payment | EmailRecipientFilterType.PaymentOrganization, subFilter: StamhoofdFilter | null, beforeFetchAllResult: BeforeFetchAllResult | undefined) {
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

    const replacementOptions = await buildReplacementOptions(result.results, beforeFetchAllResult);

    if (type === EmailRecipientFilterType.Payment) {
        recipients.push(...await getUserRecipients(userIds, replacementOptions));
        recipients.push(...await getMemberRecipients(memberIds, replacementOptions));
        recipients.push(...await getOrderRecipients(orderIds, replacementOptions));
    }
    else {
        recipients.push(...await getOrganizationRecipients(organizationIds, replacementOptions, subFilter));
    }

    return recipients;
}

async function getUserRecipients(ids: { userId: string; payment: PaymentGeneral }[], replacementOptions: ReplacementsOptions): Promise<EmailRecipient[]> {
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
                replacements: getEmailReplacementsForPayment(payment, replacementOptions),
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

async function getOrganizationRecipients(ids: { organizationId: string; payment: PaymentGeneral }[], replacementOptions: ReplacementsOptions, subFilter: StamhoofdFilter | null): Promise<EmailRecipient[]> {
    if (ids.length === 0 || subFilter === null) {
        return [];
    }

    const allOrganizationIds = Formatter.uniqueArray(ids.map(i => i.organizationId));
    const organizationMap = replacementOptions.organizationMap;

    // fetch organizations that are not in map yet
    const fetchedOrganizations = await Organization.getByIDs(...allOrganizationIds.filter(id => !organizationMap.has(id)));

    for (const organization of fetchedOrganizations) {
        organizationMap.set(organization.id, organization);
    }

    const membersForOrganizations = await getMembersForOrganizations(allOrganizationIds, subFilter);

    const results: EmailRecipient[] = [];

    for (const { organizationId, payment } of ids) {
        const organization = organizationMap.get(organizationId);

        if (organization) {
            const members = membersForOrganizations.get(organizationId);
            if (!members) {
                continue;
            }

            const replacements = getEmailReplacementsForPayment(payment, replacementOptions);

            for (const member of members) {
                for (const email of member.details.getNotificationEmails()) {
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

async function getMemberRecipients(ids: { memberId: string; payment: PaymentGeneral }[], replacementOptions: ReplacementsOptions): Promise<EmailRecipient[]> {
    if (ids.length === 0) {
        return [];
    }

    const allMemberIds = Formatter.uniqueArray(ids.map(i => i.memberId));
    const members = await Member.getByIdsWithUsers(...allMemberIds);

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
                    replacements: getEmailReplacementsForPayment(payment, replacementOptions),
                });
                results.push(recipient);
            }
        }
    }

    return results;
}

async function getOrderRecipients(ids: { orderId: string; payment: PaymentGeneral }[], replacementOptions: ReplacementsOptions): Promise<EmailRecipient[]> {
    if (ids.length === 0) {
        return [];
    }

    const orderMap = replacementOptions.orderMap;
    const results: EmailRecipient[] = [];

    for (const { orderId, payment } of ids) {
        const order = orderMap.get(orderId);

        if (order) {
            const { firstName, lastName, email } = order.data.customer;

            results.push(EmailRecipient.create({
                objectId: payment.id,
                userId: order.userId,
                firstName,
                lastName,
                email,
                replacements: getEmailReplacementsForPayment(payment, replacementOptions),
            }));
        }
    }

    return results;
}
