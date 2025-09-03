import { Formatter } from '@stamhoofd/utility';
import { type Organization } from './Organization.js';
import { type Platform } from './Platform.js';

export function getActivePeriodIds(periodId: string | null, organization: Organization | null, platform: Platform | null = null): Set<string> {
    const periods = new Set<string>();

    if (periodId) {
        periods.add(periodId);
    }

    if (organization) {
        periods.add(organization.period.period.id);

        // If the organization period is ending within 2 months, also check the next period id
        const twoMonthsFromNow = Formatter.luxon().plus({ months: 2 }).toJSDate();
        if (organization.period.period.endDate <= twoMonthsFromNow && organization.period.period.nextPeriodId) {
            periods.add(organization.period.period.nextPeriodId);
        }
        // If the organization period has only been active for less than 2 months, also check the previous period id
        const twoMonthsAgo = Formatter.luxon().minus({ months: 2 }).toJSDate();
        if (organization.period.period.startDate >= twoMonthsAgo && organization.period.period.previousPeriodId) {
            periods.add(organization.period.period.previousPeriodId);
        }
    }
    else if (STAMHOOFD.userMode === 'platform') {
        // Same for platform
        if (platform) {
            periods.add(platform.period.id);

            const twoMonthsFromNow = Formatter.luxon().plus({ months: 2 }).toJSDate();
            if (platform.period.endDate <= twoMonthsFromNow && platform.period.nextPeriodId) {
                periods.add(platform.period.nextPeriodId);
            }
            const twoMonthsAgo = Formatter.luxon().minus({ months: 2 }).toJSDate();
            if (platform.period.startDate >= twoMonthsAgo && platform.period.previousPeriodId) {
                periods.add(platform.period.previousPeriodId);
            }
        }
    }

    return periods;
}
