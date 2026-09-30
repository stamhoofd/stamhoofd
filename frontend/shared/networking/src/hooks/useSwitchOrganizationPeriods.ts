import type { Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';

export function useSwitchOrganizationPeriods() {
    const context = useContext();
    const organization = useOrganization();
    const owner = useRequestOwner();

    return async (body: {
        fromPeriodId?: string;
        toPeriodId: string;
    }, options: { periods?: OrganizationRegistrationPeriod[]; shouldRetry?: boolean; owner?: any; organizationId?: string | null } = {}) => {
        const response = await (options.organizationId !== undefined && (options.organizationId !== (context.value.organization?.id ?? null)) ? context.value.getAuthenticatedServerForOrganization(options.organizationId) : context.value.authenticatedServer).request({
            method: 'PATCH',
            path: '/organization/registration-periods/start',
            body: body,
            decoder: OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>,
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner ?? owner,
        });

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
