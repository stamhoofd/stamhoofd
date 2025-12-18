import { DateTime } from 'luxon';

export class FiscalDocumentHelper {
    /**
     * Current DateTime in Belgium
     */
    private readonly now = DateTime.now()
        .setZone('Europe/Brussels');

    /**
     * Current year in Belgium
     */
    readonly year = this.now.year;
    /**
     * Current month in Belgium
     */
    readonly month = this.now.month;

    /**
     * Previous year if current month is before March, otherwise the current year.
     */
    get defaultCalendarYear() {
        if (this.month < 3) {
            return this.year - 1;
        }

        return this.year;
    }
}
