import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import type { RegistrationPeriodBase } from '../RegistrationPeriodBase.js';

type EventDataForPeriod = {
    startDate: Date;
};

/**
 * An event doesn't store a period: it belongs to the period that contains its start date.
 */
export class EventPeriodHelper {
    static isInPeriod(event: EventDataForPeriod, period: RegistrationPeriodBase): boolean {
        return period.includesDate(event.startDate);
    }

    static isInAnyPeriod(event: EventDataForPeriod, periods: RegistrationPeriodBase[]): boolean {
        return periods.some(period => this.isInPeriod(event, period));
    }

    /**
     * Matches the events of a period, for endpoints that filter on events.
     */
    static getPeriodFilter(period: RegistrationPeriodBase): StamhoofdFilter {
        return {
            startDate: {
                $gte: period.startDate,
                $lte: period.endDate,
            },
        };
    }
}
