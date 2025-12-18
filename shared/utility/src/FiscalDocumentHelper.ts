import { DateTime } from 'luxon';

export class FiscalDocumentHelper {
    /**
     * Current DateTime in Belgium
     */
    private readonly now = DateTime.now()
        .setZone('Europe/Brussels');

    /**
    * Allow to create fiscal document for current year if current month is after this month
    */
    private readonly allowCreationAfterMonth
    // October
        = 10;

    /**
     * Current year in Belgium
     */
    readonly year = this.now.year;

    /**
     * Current month in Belgium (1-12)
     */
    readonly month = this.now.month;

    /**
     * Previous year if no fiscal document can be created for the current year. Otherwise the current year.
     */
    get defaultCalendarYear() {
        if (this.month <= this.allowCreationAfterMonth) {
            return this.year - 1;
        }

        return this.year;
    }

    /**
     * Returns if a fiscal document for this year can be created.
     */
    get canCreateFiscalDocumentForCurrentYear() {
        return this.month > this.allowCreationAfterMonth;
    }
}
