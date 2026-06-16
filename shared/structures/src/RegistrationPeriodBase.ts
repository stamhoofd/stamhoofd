import { AutoEncoder, BooleanDecoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

export class RegistrationPeriodBase extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 383 })
    customName: string | null = null;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: BooleanDecoder, optional: true })
    locked = false;

    @field({ decoder: StringDecoder, nullable: true, version: 354 })
    previousPeriodId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 382 })
    nextPeriodId: string | null = null;

    /**
     * "Year" part of "Year 2025-2026". If no year/period is detected as a suffix,
     * then this is basically the full name.
     *
     * When no custom name is set, this is basically just a translated string.
     */
    get prefix(): string {
        if (this.customName) {
            return this.customName.slice(0, this.customName.length - (this.suffix?.length ?? 0)).trim();
        }

        return $t(`%7Z`);
    }

    /**
     * "2025-2026" part of "Year 2025-2026". Multiple formats are supported as
     * both years and periods/year spans are supported.
     *
     * When no custom name is set, this is basically just a formatting of the
     * start and end dates.
     */
    get suffix(): string | null {
        if (this.customName) {
            return this.customName.trim().match(/(?:(?:\d{4}|\d{2})\s*-\s*(?:\d{4}|\d{2})|\d{4}|\d{2})$/)?.[0].trim() ?? null;
        }

        if (Formatter.year(this.endDate) === Formatter.year(this.startDate)) {
            return Formatter.year(this.startDate) + '';
        }

        return Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    /**
     *  Return the custom name, otherwise concat the prefix and suffix with a space between.
     */
    get name(): string {
        if (this.customName) {
            return this.customName;
        }

        return this.prefix + ' ' + this.suffix;
    }

    /**
     * Return a short version of the name, to be used when prefix and suffix are
     * not shown separately. Will return the suffix if exists, otherwise the prefix.
     */
    get nameShort() {
        return this.suffix || this.prefix;
    }

    getDiffValue() {
        return this.name;
    }

    /**
     * Earliest date an organization is allowed to switch to this period as default.
     */
    get switchDate() {
        if (STAMHOOFD.userMode === 'organization') {
            return null;
        }

        const d = Formatter.luxon(this.startDate).minus({ months: STAMHOOFD.environment === 'development' ? 6 : 2 }).startOf('month');
        return d.toJSDate();
    }
}
