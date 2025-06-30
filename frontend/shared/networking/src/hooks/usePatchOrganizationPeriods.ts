import { ArrayDecoder, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useContext, useOrganization } from '@stamhoofd/components';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';

export function usePatchOrganizationPeriods() {
    const context = useContext();
    const organization = useOrganization();
    const owner = useRequestOwner();

    return async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>, options: { shouldRetry?: boolean; owner?: any; organizationId?: string | null } = {}) => {
        const response = await (options.organizationId !== undefined && (options.organizationId !== (context.value.organization?.id ?? null)) ? context.value.getAuthenticatedServerForOrganization(options.organizationId) : context.value.authenticatedServer).request({
            method: 'PATCH',
            path: '/organization/registration-periods',
            body: patch,
            decoder: new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner ?? owner,
        });

        // If current organization in scope, make sure the in-memory version is updated
        organization.value?.updatePeriods(response.data);

        if (organization.value) {
            // We need to clear because there could be new periods
            organization.value.periods = undefined;
        }
        return response.data;
    };
}
