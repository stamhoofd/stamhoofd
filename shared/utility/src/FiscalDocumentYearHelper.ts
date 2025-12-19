import { DateTime } from 'luxon';

export class FiscalDocumentYearHelper {
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
    get defaultCalendarYear(): number {
        if (this.month <= this.allowCreationAfterMonth) {
            return this.year - 1;
        }

        return this.year;
    }

    /**
     * Returns if a fiscal document for this year can be created.
     */
    get canCreateFiscalDocumentForCurrentYear(): boolean {
        return this.month > this.allowCreationAfterMonth;
    }

    /**
     * Max publish date is before 1 march of next year.
     */
    getPublishDeadlineForYear(calendarYear: number): Date {
        // max publish date is before 1 march of next year
        return new Date(DateTime.fromObject({ year: calendarYear + 1, month: 3, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, { zone: 'Europe/Brussels' }).toJSDate().getTime() - 1);
    }

    /**
     * Check if the fiscal document XML can be downloaded. It can be downloaded if the fiscal document was created after the max publish date or if now is before the max publish date.
     */
    canDownloadFiscalDocumentXML(calendarYear: number, createdAt: Date): boolean {
        const deadline = this.getPublishDeadlineForYear(calendarYear);
        // if created after max publish date or if now is before max publish date
        return createdAt.getTime() > deadline.getTime() || new Date().getTime() <= deadline.getTime();
    }
}
