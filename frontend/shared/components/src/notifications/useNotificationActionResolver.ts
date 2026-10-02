import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { UrlHelper } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods.ts';
import type { Organization } from '@stamhoofd/structures';
import { AppRoute, appToUri, Group as GroupStruct, GroupType, LimitedFilteredRequest, PaginatedResponseDecoder } from '@stamhoofd/structures';
import { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { RegistrationCreatedNotificationPayload } from '@stamhoofd/structures/notifications/RegistrationCreatedNotificationPayload.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { Formatter } from '@stamhoofd/utility';
import { useAppNavigate } from '#hooks/useAppNavigate.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import { useShowMember } from '#members/hooks/useShowMember.ts';

function groupNotFoundError() {
    return new SimpleError({
        code: 'not_found',
        message: 'Group not found',
        human: $t('%ZtX'),
    });
}

export type NotificationAction = {
    name: string;
    run: () => Promise<void>;
};

export function useNotificationActionResolver() {
    const currentOrganization = useOrganization();
    const user = useUser();
    const showMember = useShowMember();
    const appNavigate = useAppNavigate();
    const context = useContext();
    const owner = useRequestOwner();
    const fetchPeriods = useFetchOrganizationRegistrationPeriods();

    function getOrganization(organizationId: string): Organization | null {
        if (currentOrganization.value?.id === organizationId) {
            return currentOrganization.value;
        }
        return user.value?.members.organizations.find(o => o.id === organizationId) ?? null;
    }

    async function fetchGroup(organization: Organization, filter: { id: string } | { waitingListId: string }): Promise<GroupStruct | null> {
        const server = organization.id === currentOrganization.value?.id
            ? context.value.authenticatedServer
            : context.value.getAuthenticatedServerForOrganization(organization.id);

        const response = await server.request({
            method: 'GET',
            path: '/groups',
            query: new LimitedFilteredRequest({ filter, limit: 1 }),
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(GroupStruct as Decoder<GroupStruct>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            owner,
        });
        return response.data.results[0] ?? null;
    }

    /**
     * Path inside the dashboard of the organization, e.g. 'leden/kapoenen/inschrijvingen'
     */
    async function getGroupPath(organization: Organization, groupId: string): Promise<string> {
        let group = await fetchGroup(organization, { id: groupId });
        if (!group) {
            throw groupNotFoundError();
        }

        let tab = 'inschrijvingen';
        if (group.type === GroupType.WaitingList) {
            // Waiting lists are shown as a tab of the group (or event) they belong to
            const parent = await fetchGroup(organization, { waitingListId: group.id });
            if (!parent) {
                throw groupNotFoundError();
            }
            group = parent;
            tab = 'wachtlijst';
        }

        if (group.eventId) {
            return `activiteiten/${group.eventId}/${tab}`;
        }

        const groupSlug = Formatter.slug(group.settings.name.toString());
        if (group.periodId === organization.period.period.id) {
            return `leden/${groupSlug}/${tab}`;
        }

        // Periods can only be listed for the organization in scope
        if (organization.id === currentOrganization.value?.id) {
            const periods = await fetchPeriods({ shouldRetry: false });
            const period = periods.organizationPeriods.find(p => p.period.id === group.periodId);
            if (period) {
                return `leden/p/${Formatter.slug(period.period.name)}/${groupSlug}/${tab}`;
            }
        }
        return 'leden';
    }

    async function navigateToDashboard(organization: Organization, path: string) {
        const prefix = appToUri('dashboard') + (STAMHOOFD.singleOrganization ? '' : '/' + organization.uri);

        // Opening the dashboard with checkRoutes matches the nested routes against this url, the same way as on page load
        UrlHelper.shared.setPath(UrlHelper.transformUrl(prefix + '/' + path));
        await appNavigate(AppRoute.Dashboard, { properties: { organization }, checkRoutes: true });
    }

    return (notification: UserNotification): NotificationAction | null => {
        const organization = notification.organizationId ? getOrganization(notification.organizationId) : null;

        if (organization && notification.type === NotificationType.RegistrationCreated) {
            const payload = RegistrationCreatedNotificationPayload.decodeBoxed(notification.payload);
            if (payload) {
                return {
                    name: $t('%ZtP'),
                    run: async () => await navigateToDashboard(organization, await getGroupPath(organization, payload.group.id)),
                };
            }
        }

        // Subjects open in the context of the organization in scope
        if ((notification.organizationId ?? null) !== (currentOrganization.value?.id ?? null)) {
            return null;
        }

        // A grouped notification is about multiple members, its subject is only the first one
        const subjectId = notification.subjectId;
        if (subjectId && notification.subjectType === NotificationSubjectType.Member && notification.groupResourceCount <= 1) {
            return {
                name: $t('%ZtI'),
                run: async () => await showMember(subjectId),
            };
        }
        return null;
    };
}
