import type { OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';

export const registrationTable = 'registrations';

export interface GroupRegistrationPeriod {
    id: string;
    periodId: string;
    settings: OrganizationRegistrationPeriodSettings;
}
