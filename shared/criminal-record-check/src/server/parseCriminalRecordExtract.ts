import { CriminalRecordParseError, CriminalRecordParseErrorCode } from './CriminalRecordParseError.js';

/**
 * The labels we read the fields from. Every entry is a list of accepted spellings, so another
 * wording - a second Dutch variant, or the French and German equivalents - can be appended without
 * touching the matching logic.
 *
 * There is no language detection: a field either resolves or it is null, and the check that needs
 * it then fails with its own explanation.
 */
export const CRIMINAL_RECORD_LABELS = {
    lastName: ['Naam', 'Familienaam'],
    firstName: ['Voorna(a)m(en)', 'Voornaam', 'Voornamen'],
    birthDate: ['Geboortedatum'],
    documentDate: ['Datum'],
    /** The value is on the NEXT line, not after the label. */
    purpose: ['Finaliteit van het uittreksel'],
} as const;

/** Present = blank. Absent = not blank. That is the whole determination. */
export const CRIMINAL_RECORD_BLANK_MARKERS = ['BLANCO STRAFREGISTER'];

export interface ParsedCriminalRecordExtract {
    firstName: string | null;
    lastName: string | null;
    birthDay: Date | null;
    /** The date the extract was issued. */
    issuedAt: Date | null;
    /** The purpose of the extract, which holds the model number. */
    purpose: string | null;
    /**
     * True only when a blank marker is literally present. Everything else is false, which routes the
     * document to a human rather than to an approval.
     */
    isBlank: boolean;
}

/**
 * Read the fields of an extract from its text, in reading order (see extractPdfLines).
 *
 * A partial read is not an error: the individual checks fail with their own explanations, which
 * tells the member something useful instead of one opaque "unreadable".
 */
export function parseCriminalRecordExtract(lines: string[]): ParsedCriminalRecordExtract {
    const parsed: ParsedCriminalRecordExtract = {
        firstName: readLabelledValue(lines, CRIMINAL_RECORD_LABELS.firstName),
        lastName: readLabelledValue(lines, CRIMINAL_RECORD_LABELS.lastName),
        birthDay: parseDate(readLabelledValue(lines, CRIMINAL_RECORD_LABELS.birthDate)),
        issuedAt: parseDate(readLabelledValue(lines, CRIMINAL_RECORD_LABELS.documentDate)),
        purpose: readValueOnNextLine(lines, CRIMINAL_RECORD_LABELS.purpose),
        isBlank: containsBlankMarker(lines),
    };

    if (parsed.firstName === null && parsed.lastName === null && parsed.birthDay === null && parsed.issuedAt === null && parsed.purpose === null) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.UnrecognisedLayout, 'none of the mandatory fields resolved');
    }

    return parsed;
}

/**
 * Read a field written as `Label: value` on one line. Tries every accepted spelling until one
 * resolves to a non-empty value.
 */
function readLabelledValue(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(\\S.*)$`, 'i');

        for (const line of lines) {
            const value = pattern.exec(line)?.[1].trim();
            if (value) {
                return value;
            }
        }
    }

    return null;
}

/**
 * Read a field whose value is printed on the line below its label.
 */
function readValueOnNextLine(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：]?\\s*(.*)$`, 'i');

        for (const [index, line] of lines.entries()) {
            const match = pattern.exec(line);
            if (!match) {
                continue;
            }

            // A wording that does print the value behind the label still resolves
            const sameLine = match[1].trim();
            if (sameLine) {
                return sameLine;
            }

            const next = lines[index + 1]?.trim();
            if (next) {
                return next;
            }
        }
    }

    return null;
}

function containsBlankMarker(lines: string[]): boolean {
    return lines.some(line => CRIMINAL_RECORD_BLANK_MARKERS.some(marker => normalizeForMarker(line).includes(normalizeForMarker(marker))));
}

function normalizeForMarker(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

/**
 * Dates are printed as 31/12/2026. The result is midnight UTC, so it is the same calendar day in
 * the timezone every other date comparison uses.
 */
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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
