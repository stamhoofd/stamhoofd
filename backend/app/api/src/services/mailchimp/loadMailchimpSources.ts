import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import { Platform, Webshop } from '@stamhoofd/models';
import type { MemberWithRegistrationsBlob, RecordAnswer, StamhoofdFilter } from '@stamhoofd/structures';
import type { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { GroupType, LimitedFilteredRequest, OrderStatus, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, SortItemDirection } from '@stamhoofd/structures';
import type { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { MailchimpSyncType } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { GetMembersEndpoint } from '../../endpoints/global/members/GetMembersEndpoint.js';
import { GetWebshopOrdersEndpoint } from '../../endpoints/organization/dashboard/webshops/GetWebshopOrdersEndpoint.js';
import type { MailchimpContactSource } from './buildContacts.js';
import type { MailchimpAbortSignal } from './MailchimpClient.js';
import type { MailchimpTags } from './MailchimpTags.js';

const PAGE_SIZE = 100;

async function getCurrentPeriodId(organization: Organization | null) {
    if (organization) {
        return organization.periodId;
    }
    return (await Platform.getShared()).periodId;
}

async function getFullSyncFilter(organization: Organization | null): Promise<StamhoofdFilter> {
    return {
        registrations: {
            $elemMatch: {
                ...(organization ? { organizationId: organization.id } : {}),
                periodId: await getCurrentPeriodId(organization),
                group: {
                    type: GroupType.Membership,
                },
            },
        },
    };
}

function getRecordTags(answer: RecordAnswer, tags: MailchimpTags): string[] {
    if (answer.settings.sensitive) {
        return [];
    }
    const name = answer.settings.name.toString();
    if (answer instanceof RecordCheckboxAnswer) {
        return answer.selected ? [tags.record(name)] : [];
    }
    if (answer instanceof RecordChooseOneAnswer) {
        return answer.selectedChoice ? [tags.recordChoice(name, answer.selectedChoice.name.toString())] : [];
    }
    if (answer instanceof RecordMultipleChoiceAnswer) {
        return answer.selectedChoices.map(choice => tags.recordChoice(name, choice.name.toString()));
    }
    return [];
}

function hasConsent(answer: RecordAnswer | undefined, settings: MailchimpSettings): boolean {
    if (!answer) {
        return false;
    }
    if (answer instanceof RecordCheckboxAnswer) {
        return answer.selected;
    }
    if (answer instanceof RecordChooseOneAnswer) {
        return !!answer.selectedChoice && settings.newsletterChoiceIds.includes(answer.selectedChoice.id);
    }
    if (answer instanceof RecordMultipleChoiceAnswer) {
        return answer.selectedChoices.some(choice => settings.newsletterChoiceIds.includes(choice.id));
    }
    return false;
}

function getMemberSources(
    member: MemberWithRegistrationsBlob,
    organizationNames: Map<string, string>,
    options: { organization: Organization | null; periodId: string; settings: MailchimpSettings; tags: MailchimpTags },
): MailchimpContactSource[] {
    const registrations = member.registrations.filter(r =>
        r.registeredAt !== null
        && r.deactivatedAt === null
        && r.group.periodId === options.periodId
        && r.group.type === GroupType.Membership
        && (!options.organization || r.organizationId === options.organization.id),
    );

    // Group records are answered per registration
    const findAnswer = (recordId: string) => member.details.recordAnswers.get(recordId) ?? registrations.find(r => r.recordAnswers.has(recordId))?.recordAnswers.get(recordId);

    const groups = registrations.map(r => r.group.settings.name.toString());
    const organizations = options.organization ? [] : registrations.map(r => organizationNames.get(r.organizationId) ?? '').filter(n => !!n);

    const tags = [
        ...groups.map(g => options.tags.group(g)),
        ...organizations.map(o => options.tags.organization(o)),
    ];
    for (const recordId of options.settings.tagRecordIds) {
        const answer = findAnswer(recordId);
        if (answer) {
            tags.push(...getRecordTags(answer, options.tags));
        }
    }

    const consent = options.settings.newsletterRecordId ? hasConsent(findAnswer(options.settings.newsletterRecordId), options.settings) : null;

    const base = {
        sortKey: member.id,
        memberFirstName: member.details.firstName,
        groups,
        organizations,
        consent,
    };

    const sources: MailchimpContactSource[] = [];
    if (member.details.email) {
        sources.push({
            ...base,
            email: member.details.email,
            firstName: member.details.firstName,
            lastName: member.details.lastName,
            tags: [options.tags.member, ...tags],
        });
    }
    for (const parent of member.details.parents) {
        if (parent.email) {
            sources.push({
                ...base,
                email: parent.email,
                firstName: parent.firstName,
                lastName: parent.lastName,
                tags: [options.tags.parent, ...tags],
            });
        }
    }
    return sources;
}

async function loadMemberSources(organization: Organization | null, request: MailchimpSyncRequest, settings: MailchimpSettings, tags: MailchimpTags, signal?: MailchimpAbortSignal) {
    const periodId = await getCurrentPeriodId(organization);
    const sources: MailchimpContactSource[] = [];

    let query: LimitedFilteredRequest | null = new LimitedFilteredRequest({
        filter: request.full ? await getFullSyncFilter(organization) : request.filter,
        search: request.full ? null : request.search,
        sort: [{ key: 'id', order: SortItemDirection.ASC }],
        limit: PAGE_SIZE,
    });

    while (query) {
        signal?.throwIfAborted();
        const response = await GetMembersEndpoint.buildData(query);
        const organizationNames = new Map(response.results.organizations.map(o => [o.id, o.name]));

        for (const member of response.results.members) {
            sources.push(...getMemberSources(member, organizationNames, { organization, periodId, settings, tags }));
        }
        query = response.next ?? null;
    }
    return sources;
}

async function loadOrderSources(organization: Organization | null, request: MailchimpSyncRequest, mailchimpTags: MailchimpTags, signal?: MailchimpAbortSignal) {
    const webshop = request.webshopId ? await Webshop.getByID(request.webshopId) : null;
    if (!organization || !webshop || webshop.organizationId !== organization.id) {
        throw new SimpleError({
            code: 'invalid_field',
            message: 'Webshop not found',
            human: $t('Deze webshop werd niet gevonden'),
            field: 'webshopId',
        });
    }

    const tags = [mailchimpTags.customer, mailchimpTags.webshop(webshop.meta.name)];
    const sources: MailchimpContactSource[] = [];

    const filter: StamhoofdFilter = request.filter ? [{ webshopId: webshop.id }, request.filter] : { webshopId: webshop.id };
    let query: LimitedFilteredRequest | null = new LimitedFilteredRequest({
        filter,
        search: request.search,
        sort: [{ key: 'id', order: SortItemDirection.ASC }],
        limit: PAGE_SIZE,
    });

    while (query) {
        signal?.throwIfAborted();
        const response = await GetWebshopOrdersEndpoint.buildData(query);

        for (const order of response.results) {
            if (order.webshopId !== webshop.id || order.status === OrderStatus.Canceled || order.status === OrderStatus.Deleted) {
                continue;
            }
            const customer = order.data.customer;
            if (!customer.email) {
                continue;
            }
            sources.push({
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                sortKey: order.id,
                memberFirstName: null,
                groups: [],
                organizations: [],
                tags,
                consent: null,
            });
        }
        query = response.next ?? null;
    }
    return sources;
}

/**
 * Loads the data via the same builders as the dashboard, so filters and permission scoping are identical
 */
export async function loadMailchimpSources(organization: Organization | null, request: MailchimpSyncRequest, settings: MailchimpSettings, tags: MailchimpTags, signal?: MailchimpAbortSignal): Promise<MailchimpContactSource[]> {
    if (request.type === MailchimpSyncType.Orders) {
        return await loadOrderSources(organization, request, tags, signal);
    }
    return await loadMemberSources(organization, request, settings, tags, signal);
}
