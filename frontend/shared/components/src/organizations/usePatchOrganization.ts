import { useOrganization } from '#hooks/useOrganization';
import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Organization } from '@stamhoofd/structures';
import { GlobalEventBus } from '../EventBus';
import { useContext } from '../hooks/useContext';
import { clearOrganizationPeriodsCache } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';

export function usePatchOrganization() {
    const organization = useOrganization();
    const context = useContext();
    const owner = useRequestOwner();

    return async function patch(patch: AutoEncoderPatchType<Organization>, options: { shouldRetry?: boolean} = {}) {
        if (!organization.value) {
            throw new SimpleError({
                code: 'no_organization',
                message: 'No organization loaded',
            });
        }

        patch.id = organization.value.id;

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization',
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry: options.shouldRetry ?? false,
            owner
        });

        // Keep admins
        context.value.updateOrganization(response.data);

        if (patch.period) {
            // Clear cached periods
            clearOrganizationPeriodsCache();
        }

        await GlobalEventBus.sendEvent('organization-updated', organization.value);
    }
}
