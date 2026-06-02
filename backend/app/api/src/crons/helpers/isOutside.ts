import { Formatter } from '@stamhoofd/utility';

type TimeString = `${0 | 1 | 2}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}:${0 | 1 | 2 | 3 | 4 | 5 | 6}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export function isOutside(start: TimeString, end: TimeString) {
    // Only send emails between 8:00 - 18:00 CET
    const CETTime = Formatter.timeIso(new Date());
    if ((CETTime < start || CETTime > end)) {
        return true;
    }
    return false;
}
