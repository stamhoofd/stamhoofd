import type { RegistrationPeriod } from '@stamhoofd/structures';

export function isValidRegistrationPeriodCustomName(period: RegistrationPeriod): boolean {
    if (!period.customName
        // after the migration of v1 the oldest period is called "Gearchiveerde periodes" -> no warning should be shown
        || period.customName === 'Gearchiveerde periodes') {
        return true;
    }

    const suffix = period.suffix;
    if (!suffix) {
        return false;
    }

    const startYear = period.startDate.getFullYear();
    const endYear = period.endDate.getFullYear();

    // skip extreme cases
    if (startYear < 1900 || endYear > 9999 || startYear > endYear) {
        return true;
    }

    // should contain year between start and end dates (start and end dates included)
    for (let i = startYear; i <= endYear; i++) {
        const fullYear = i.toString();
        const shortYear = fullYear.substring(2);

        if (suffix.includes(fullYear) || suffix.includes(shortYear)) {
            return true;
        }
    }

    return false;
}
