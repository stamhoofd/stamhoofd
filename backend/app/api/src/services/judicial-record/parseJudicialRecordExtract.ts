import { containsText, readInlineLabelledValue, readLabelledValue, readValueOnNextLine } from '@stamhoofd/pdf-parse';

/**
 * We read the document but do not recognise what is in it: an unsupported wording, another model, a
 * tampered file. Next to the codes of @stamhoofd/pdf-parse, which say a pdf could not be read.
 */
export class JudicialRecordLayoutError extends Error {
    readonly code = 'UNRECOGNISED_LAYOUT';

    constructor(reason: string) {
        super(`UNRECOGNISED_LAYOUT: ${reason}`);
    }
}

/**
 * A list of accepted spellings per field, so another wording - a second Dutch variant, or the French
 * and German equivalents - can be appended without touching the matching. There is no language
 * detection: a field either resolves or it is null.
 */
export const JUDICIAL_RECORD_LABELS = {
    lastName: ['Naam', 'Familienaam'],
    firstName: ['Voorna(a)m(en)', 'Voornaam', 'Voornamen'],
    birthDate: ['Geboortedatum'],
    /**
     * Printed in the header, next to the reference and the subject, not on a line of its own. The
     * blank marker carries a date too - `BLANCO STRAFREGISTER (02/11/2026)` - but that one says
     * when the register was blank, so only the header's date is read as the date of the document.
     */
    documentDate: ['Datum'],
    /** The value is on the NEXT line, not after the label. */
    purpose: ['Finaliteit van het uittreksel'],
} as const;

/** Present = blank. Absent = not blank. That is the whole determination. */
export const JUDICIAL_RECORD_BLANK_MARKERS = ['BLANCO STRAFREGISTER'];

export interface ParsedJudicialRecordExtract {
    firstName: string | null;
    lastName: string | null;
    birthDay: Date | null;
    issuedAt: Date | null;
    /** Holds the model number. */
    purpose: string | null;
    /**
     * True only when a marker is literally present: everything else routes the document to a human
     * rather than to an approval.
     */
    isBlank: boolean;
}

/**
 * A partial read is not an error: the individual checks then fail with their own explanations, which
 * tells the member something useful instead of one opaque "unreadable".
 */
export function parseJudicialRecordExtract(lines: string[]): ParsedJudicialRecordExtract {
    const parsed: ParsedJudicialRecordExtract = {
        firstName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.firstName),
        lastName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.lastName),
        birthDay: parseDate(readLabelledValue(lines, JUDICIAL_RECORD_LABELS.birthDate)),
        issuedAt: parseDate(readInlineLabelledValue(lines, JUDICIAL_RECORD_LABELS.documentDate)),
        purpose: readValueOnNextLine(lines, JUDICIAL_RECORD_LABELS.purpose),
        isBlank: containsText(lines, JUDICIAL_RECORD_BLANK_MARKERS),
    };

    if (parsed.firstName === null && parsed.lastName === null && parsed.birthDay === null && parsed.issuedAt === null && parsed.purpose === null) {
        throw new JudicialRecordLayoutError('none of the mandatory fields resolved');
    }

    return parsed;
}

/** Midnight UTC, so it is the same calendar day in the timezone the comparisons use. */
function parseDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    const match = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/.exec(value);
    if (!match) {
        return null;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const date = new Date(Date.UTC(year, month - 1, day));

    // Reject a date that does not exist, e.g. 31/02/2026, which Date would roll over
    if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year) {
        return null;
    }

    return date;
}
