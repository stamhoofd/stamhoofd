import { Formatter } from '@stamhoofd/utility';
import type { Organization } from './Organization.js';
import type { Platform } from './Platform.js';

type NamedPeriod = {
    name: string;
    id: string;
};

export function getActivePeriods(period: NamedPeriod | null, organization: Organization | null, platform: Platform | null = null): NamedPeriod[] {
    const periods = new Map<string, NamedPeriod>();

    if (period) {
        periods.set(period.id, period);
    }

    if (organization) {
        periods.set(organization.period.period.id, organization.period.period);

        // If the organization period is ending within 2 months, also check the next period id
        const twoMonthsFromNow = Formatter.luxon().plus({ months: 2 }).toJSDate();
        if (organization.period.period.endDate <= twoMonthsFromNow && organization.period.period.nextPeriodId) {
            periods.set(organization.period.period.nextPeriodId, {
                id: organization.period.period.nextPeriodId,
                name: $t('Volgend werkjaar'),
            });
        }
        // If the organization period has only been active for less than 2 months, also check the previous period id
        const twoMonthsAgo = Formatter.luxon().minus({ months: 2 }).toJSDate();
        if (organization.period.period.startDate >= twoMonthsAgo && organization.period.period.previousPeriodId) {
            periods.set(organization.period.period.previousPeriodId, {
                id: organization.period.period.previousPeriodId,
                name: $t('Vorig werkjaar'),
            });
        }
    } else if (STAMHOOFD.userMode === 'platform') {
        // Same for platform
        if (platform) {
            periods.set(platform.period.id, platform.period);

            const twoMonthsFromNow = Formatter.luxon().plus({ months: 2 }).toJSDate();
            if (platform.period.endDate <= twoMonthsFromNow && platform.period.nextPeriodId) {
                periods.set(platform.period.nextPeriodId, {
                    id: platform.period.nextPeriodId,
                    name: $t('Volgend werkjaar'),
                });
            }
            const twoMonthsAgo = Formatter.luxon().minus({ months: 2 }).toJSDate();
            if (platform.period.startDate >= twoMonthsAgo && platform.period.previousPeriodId) {
                periods.set(platform.period.previousPeriodId, {
                    id: platform.period.previousPeriodId,
                    name: $t('Vorig werkjaar'),
                });
            }
        }
    }

    return [...periods.values()];
}

export function getActivePeriodIds(periodId: string | null, organization: Organization | null, platform: Platform | null = null): string[] {
    return getActivePeriods(periodId ? { id: periodId, name: '' } : null, organization, platform).map(p => p.id);
}
