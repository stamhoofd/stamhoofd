import { BalanceItem, BalanceItemPayment, Email, Member, MemberResponsibilityRecord, Order, Organization, Payment, RecipientLoader, User, Webshop } from '@stamhoofd/models';
import { compileToSQLFilter, SQL } from '@stamhoofd/sql';
import { BalanceItemRelationType, BalanceItemType, CountFilteredRequest, EmailRecipient, EmailRecipientFilterType, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, PaymentMethod, PaymentMethodHelper, Replacement, StamhoofdFilter, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { createOrderDataHTMLTable, createPaymentDataHTMLTable } from '../helpers/email-html-helpers.js';
import { memberResponsibilityRecordFilterCompilers } from '../sql-filters/member-responsibility-records.js';

type ReplacementsOptions = {
    shouldAddReplacementsForOrder: boolean;
    shouldAddReplacementsForTransfers: boolean;
    orderMap: Map<string, Order>;
    webshopMap: Map<string, Webshop>;
    organizationMap: Map<string, Organization>;
};

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

    // get all orders linked to the payments
    const allOrderIdsSet = new Set<string>();
    const allWebshopIdsSet = new Set<string>();
    const organizationIdsForOrdersSet = new Set<string>();

    for (const payment of result.results) {
        payment.webshopIds.forEach(id => allWebshopIdsSet.add(id));

        for (const balanceItemPayment of payment.balanceItemPayments) {
            const balanceItem = balanceItemPayment.balanceItem;
            if (balanceItem.orderId) {
                allOrderIdsSet.add(balanceItem.orderId);

                // only important if balance item has order
                organizationIdsForOrdersSet.add(balanceItem.organizationId);
            }
        }
    }

    // get all orders (for replacements later)
    const orders = await Order.getByIDs(...allOrderIdsSet);
    const orderMap = new Map<string, Order>(orders.map(o => [o.id, o] as [string, Order]));

    // get all webshops (for replacements later)
    const webshops = await Webshop.getByIDs(...allWebshopIdsSet);
    const webshopMap = new Map<string, Webshop>(webshops.map(w => [w.id, w] as [string, Webshop]));

    // get all organizations (for replacements later)
    const organizations = await Organization.getByIDs(...organizationIdsForOrdersSet);
    const organizationMap = new Map<string, Organization>(organizations.map(o => [o.id, o] as [string, Organization]));

    const replacementOptions: ReplacementsOptions = {
        shouldAddReplacementsForOrder: beforeFetchAllResult ? !beforeFetchAllResult.doesIncludePaymentWithoutOrders : false,
        shouldAddReplacementsForTransfers: beforeFetchAllResult ? beforeFetchAllResult.areAllPaymentsTransfers : false,
        orderMap,
        webshopMap,
        organizationMap,
    };

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

function getEmailReplacementsForPayment(payment: PaymentGeneral, options: ReplacementsOptions): Replacement[] {
    const { orderMap, webshopMap, organizationMap, shouldAddReplacementsForOrder, shouldAddReplacementsForTransfers } = options;
    const orderIds = new Set<string>();

    for (const balanceItemPayment of payment.balanceItemPayments) {
        const orderId = balanceItemPayment.balanceItem.orderId;
        if (orderId) {
            orderIds.add(orderId);
        }
    }

    // will be set if only 1 order is linked
    let singleOrder: Order | null = null;

    if (orderIds.size === 1) {
        const singleOrderId = [...orderIds][0];
        if (singleOrderId) {
            const order = orderMap.get(singleOrderId);

            if (order) {
                singleOrder = order;
            }
        }
    }

    let orderUrlReplacement: Replacement | null = null;

    // add replacement for order url if only 1 order is linked
    if (singleOrder && shouldAddReplacementsForOrder) {
        const webshop = webshopMap.get(singleOrder.webshopId);
        const organization = organizationMap.get(singleOrder.organizationId);

        if (webshop && organization) {
            const webshopStruct = WebshopStruct.create(webshop);

            orderUrlReplacement = Replacement.create({
                token: 'orderUrl',
                value: 'https://' + webshopStruct.getUrl(organization) + '/order/' + (singleOrder.id),
            });
        }
    }

    const createPaymentDataHtml = () => {
        if (singleOrder) {
            const webshop = webshopMap.get(singleOrder.webshopId);
            if (webshop) {
                return createOrderDataHTMLTable(singleOrder, webshop);
            }
        }

        return createPaymentDataHTMLTable(payment);
    };

    const paymentDataHtml = createPaymentDataHtml();
    const paymentDataReplacement = paymentDataHtml
        ? Replacement.create({
                token: 'paymentData',
                value: '',
                html: paymentDataHtml,
            })
        : null;

    return ([
        Replacement.create({
            token: 'paymentPrice',
            value: Formatter.price(payment.price),
        }),
        Replacement.create({
            token: 'paymentMethod',
            value: PaymentMethodHelper.getName(payment.method ?? PaymentMethod.Unknown),
        }),
        ...(shouldAddReplacementsForTransfers
            ? [
                    Replacement.create({
                        token: 'transferDescription',
                        value: (payment.transferDescription ?? ''),
                    }),
                    Replacement.create({
                        token: 'transferBankAccount',
                        value: payment.transferSettings?.iban ?? '',
                    }),
                    Replacement.create({
                        token: 'transferBankCreditor',
                        // todo?
                        value: payment.transferSettings?.creditor ?? (payment.organizationId ? organizationMap.get(payment.organizationId)?.name : ''),
                    }),
                ]
            : []),

        Replacement.create({
            token: 'balanceItemPaymentsTable',
            value: '',
            // todo: unbox orders?
            html: payment.getBalanceItemPaymentsHtmlTable(),
        }),
        Replacement.create({
            token: 'paymentTable',
            value: '',
            html: payment.getHTMLTable(),
        }),
        Replacement.create({
            token: 'overviewContext',
            value: getPaymentContext(payment, options),
        }),
        orderUrlReplacement,
        paymentDataReplacement,
    ]).filter(replacementOrNull => replacementOrNull !== null);
}

function getPaymentContext(payment: PaymentGeneral, { orderMap, webshopMap }: ReplacementsOptions) {
    const overviewContext = new Set<string>();
    const registrationMemberNames = new Set<string>();

    // only add to context if type is order or registration
    for (const balanceItemPayment of payment.balanceItemPayments) {
        const balanceItem = balanceItemPayment.balanceItem;
        const type = balanceItem.type;

        switch (type) {
            case BalanceItemType.Order: {
                if (balanceItem.orderId) {
                    const order = orderMap.get(balanceItem.orderId);

                    if (order) {
                        const webshop = webshopMap.get(order.webshopId);
                        if (webshop) {
                            overviewContext.add($t('{webshop} (bestelling {orderNumber})', {
                                webshop: webshop.meta.name,
                                orderNumber: order.number ?? '',
                            }));
                        }
                        else {
                            overviewContext.add($t('Bestelling {orderNumber}', {
                                orderNumber: order.number ?? '',
                            }));
                        }
                    }
                }
                break;
            }
            case BalanceItemType.Registration: {
                const memberName = balanceItem.relations.get(BalanceItemRelationType.Member)?.name.toString();
                if (memberName) {
                    registrationMemberNames.add(memberName);
                }
                else {
                    overviewContext.add(balanceItem.itemTitle);
                }

                break;
            }
            default: {
                break;
            }
        }
    }

    if (registrationMemberNames.size > 0) {
        const memberNames = Formatter.joinLast([...registrationMemberNames], ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
        overviewContext.add($t(`01d5fd7e-2960-4eb4-ab3a-2ac6dcb2e39c`) + ' ' + memberNames);
    }

    if (overviewContext.size === 0) {
        // add item title if no balance items with type order or registration
        if (payment.balanceItemPayments.length === 1) {
            const balanceItem = payment.balanceItemPayments[0].balanceItem;
            return balanceItem.itemTitle;
        }

        if (payment.balanceItemPayments.length > 1) {
            // return title if all balance items have the same title
            const firstTitle = payment.balanceItemPayments[0].balanceItem.itemTitle;
            const haveAllSameTitle = payment.balanceItemPayments.every(p => p.balanceItem.itemTitle === firstTitle);

            if (haveAllSameTitle) {
                return `${firstTitle} (${payment.balanceItemPayments.length}x)`;
            }

            // else return default text for multiple items
            return $t('Betaling voor {count} items', { count: payment.balanceItemPayments.length });
        }

        // else return default text for single item
        return $t('Betaling voor 1 item');
    }

    // join texts for balance items with type order or registration
    return [...overviewContext].join(', ');
}

type BeforeFetchAllResult = {
    doesIncludePaymentWithoutOrders: boolean;
    areAllPaymentsTransfers: boolean;
};

async function fetchPaymentRecipients(query: LimitedFilteredRequest, beforeFetchAllResult?: BeforeFetchAllResult) {
    const result = await GetPaymentsEndpoint.buildData(query);

    return new PaginatedResponse({
        results: await getRecipients(result, EmailRecipientFilterType.Payment, null, beforeFetchAllResult),
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
    fetch: async (query: LimitedFilteredRequest, _subfilter, beforeFetchAllResult) => fetchPaymentRecipients(query, beforeFetchAllResult),
    // For now: only count the number of payments - not the amount of emails
    count: async (query: LimitedFilteredRequest, _subfilter) => {
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
