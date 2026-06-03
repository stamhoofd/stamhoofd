import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Sorter } from '@stamhoofd/utility';
import { useOrganizationManager } from '../OrganizationManager';
import { useFetchOrganizationRegistrationPeriods } from './useFetchOrganizationRegistrationPeriods';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';

export function useLoadRecentPeriods() {
    const organizationManager = useOrganizationManager();
    const fetch = useFetchOrganizationRegistrationPeriods();

    const getPeriods = async (period?: OrganizationRegistrationPeriod) => {
        try {
            const data = await fetch({ shouldRetry: false, force: false });

            const periods = data.organizationPeriods;
            if (periods === undefined) {
                return [period ?? organizationManager.value.organization.period];
            }

            const periodsCopy = [...periods];

            periodsCopy.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));

            return periodsCopy;
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return [];
        }
    };

    return getPeriods;
}
