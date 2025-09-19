import { Toast } from '@stamhoofd/components';
import { Sorter } from '@stamhoofd/utility';
import { useOrganizationManager } from '../OrganizationManager';
import { useRequestOwner } from './useRequestOwner';

export function useGetPeriods() {
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();

    const getPeriods = async () => {
        try {
            await organizationManager.value.loadPeriods(false, false, owner);
        }
        catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return [];
        }

        const periods = organizationManager.value.organization.periods?.organizationPeriods;
        if (periods === undefined) {
            return [organizationManager.value.organization.period];
        }

        const periodsCopy = [...periods];

        periodsCopy.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));

        return periodsCopy;
    };

    return getPeriods;
}
