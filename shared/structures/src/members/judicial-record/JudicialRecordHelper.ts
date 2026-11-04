import { Formatter } from '@stamhoofd/utility';

/** An extract is required from this age on. */
export const JUDICIAL_RECORD_MIN_AGE = 20;

/** How long before the birthday we start asking for the extract. */
export const JUDICIAL_RECORD_LEAD_TIME_DAYS = 30;

/** How long an approval (or a permanent rejection) stays valid. */
export const JUDICIAL_RECORD_VALIDITY_YEARS = 3;

/** How old the extract may be on the day it is delivered. */
export const JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS = 31;

export class JudicialRecordHelper {
    /**
     * Accents, hyphens, apostrophes, casing and whitespace are absorbed; everything else has to
     * match exactly.
     */
    static normalizeName(value: string): string {
        return value
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/['-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    static isSameName(a: string, b: string): boolean {
        return this.normalizeName(a) === this.normalizeName(b);
    }

    /** Calendar days in the configured timezone, like every other date comparison. */
    static isSameBirthDay(a: Date, b: Date): boolean {
        return Formatter.dateIso(a) === Formatter.dateIso(b);
    }
}
