import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { usePatchOrganizationPeriods } from './usePatchOrganizationPeriods';

export function usePatchOrganizationPeriod() {
    const patchOrganizationPeriods = usePatchOrganizationPeriods();

    return async (period: OrganizationRegistrationPeriod, patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>, options: { shouldRetry?: boolean; owner?: any; organizationId?: string | null } = {}) => {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;

        arr.addPatch(patch);

        return (await patchOrganizationPeriods(arr, { ...options, periods: [period] }))[0];
    };
}
