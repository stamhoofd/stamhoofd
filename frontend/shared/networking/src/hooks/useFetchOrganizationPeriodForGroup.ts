import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useContext } from '@stamhoofd/components';
import { Group, LimitedFilteredRequest, OrganizationRegistrationPeriod, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';

export function useFetchOrganizationPeriodForGroup() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function (group: Group) {
        const organizationId = group.organizationId;
        const periodId = group.periodId;

        // Request data
        const response = await context.value.getAuthenticatedServerForOrganization(organizationId).request({
            method: 'GET',
            path: '/organization/registration-periods',
            query: new LimitedFilteredRequest({
                filter: {
                    periodId: periodId,
                },
                limit: 1,
                sort: [
                    {
                        key: 'id',
                        order: SortItemDirection.ASC,
                    },
                ],
            }),
            decoder: new PaginatedResponseDecoder(
                new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
                LimitedFilteredRequest,
            ),
            owner,
            shouldRetry: true,
        });

        if (!response.data.results[0]) {
            throw new SimpleError({
                code: 'missing-organization-period',
                message: 'Missing organization period',
                human: $t('cd37a13c-6779-49fa-a97f-1eddb6b61ebb'),
            });
        }

        const period = response.data.results[0];

        // Assert the group inside the period (since it is an event, it won't be included)
        if (!period.groups.some(g => g.id === group.id)) {
            // Add the group to the period
            period.groups.push(group);
        }

        return period;
    };
}
