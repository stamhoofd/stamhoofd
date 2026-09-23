import { Formatter } from '@stamhoofd/utility';
import { Interval } from 'luxon';

/**
 * Amount of calendar days from `start` up to and including `end`, on Brussels day boundaries
 */
export function countDays(start: Date, end: Date): number {
    const startDay = Formatter.luxon(start).startOf('day');
    const endDay = Formatter.luxon(end).startOf('day');
    const days = Interval.fromDateTimes(startDay, endDay).length('days');
    if (isNaN(days)) {
        return 0;
    }
    return days + 1;
}
