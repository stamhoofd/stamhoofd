import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { usePatchOrganizationPeriods } from './usePatchOrganizationPeriods';

export function usePatchOrganizationPeriod() {
    const patchOrganizationPeriods = usePatchOrganizationPeriods();

    return async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>, options: { shouldRetry?: boolean; owner?: any; organizationId?: string | null } = {}) => {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
        arr.addPatch(patch);

        return (await patchOrganizationPeriods(arr, options))[0];
    };
}
