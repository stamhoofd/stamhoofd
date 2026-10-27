import type { Decoder } from '@simonbackx/simple-encoding';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';

export function useSwitchOrganizationPeriods() {
    const context = useContext();
    const organization = useOrganization();
    const owner = useRequestOwner();

    return async (body: {
        fromOrganizationRegistrationPeriodId?: string;
        toRegistrationPeriodId: string;
    }, options: { periods?: OrganizationRegistrationPeriod[]; shouldRetry?: boolean; owner?: any; organizationId?: string | null } = {}) => {
        const response = await (options.organizationId !== undefined && (options.organizationId !== (context.value.organization?.id ?? null)) ? context.value.getAuthenticatedServerForOrganization(options.organizationId) : context.value.authenticatedServer).request({
            method: 'POST',
            path: '/organization/registration-periods/start',
            body: body,
            decoder: OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>,
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner ?? owner,
        });

        console.log(response);

        // If current organization in scope, make sure the in-memory version is updated
        organization.value?.updatePeriods([response.data]);

        if (organization.value) {
            // We need to clear because there could be new periods
            organization.value.periods = undefined;
        }

        if (options.periods) {
            for (const period of options.periods ?? []) {
                if (response.data.id === period.id) {
                    period.deepSet(response.data);
                }
            }
        }

        return response.data;
    };
}
