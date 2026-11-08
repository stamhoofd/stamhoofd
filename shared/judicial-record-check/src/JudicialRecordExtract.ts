import { parsePrintedDate, readDatedLabelledValue, readInlineLabelledValue, readLabelledValue, readMarkerDate, readValueOnNextLine } from '@stamhoofd/pdf-parse';
import { readJudicialRecordExtractUrl } from './judicialRecordExtractUrl.js';

/**
 * What an extract of FOD Justitie prints its fields behind. A list of accepted spellings per field,
 * so another wording - a second Dutch variant, or the French and German equivalents - can be
 * appended without touching anything else. There is no language detection: a field either resolves
 * or it is null.
 */
export const JUDICIAL_RECORD_LABELS = {
    lastName: ['Naam', 'Familienaam'],
    firstName: ['Voorna(a)m(en)', 'Voornaam', 'Voornamen'],
    birthDay: ['Geboortedatum'],
    /**
     * Printed in the header, next to the reference and the subject, not on a line of its own. The
     * blank marker carries a date too, but that one says since when the register is blank.
     */
    documentDate: ['Datum'],
    /** The value sits on the line below the label, and holds the model number. */
    purpose: ['Finaliteit van het uittreksel'],
    /**
     * The sentence an extract closes with, naming until when FOD Justitie will answer for it and
     * where, with the url on the line below. The date sits inside the label, so the wording is a
     * template with `{date}` where the document prints it.
     */
    url: ['De authenticiteit van dit uittreksel kan tot {date} gecontroleerd worden via'],
} as const;

/** The heading an extract states its own blankness under, with the date it was established beside it. */
export const JUDICIAL_RECORD_BLANK_MARKERS = ['BLANCO STRAFREGISTER'];

/** The model for activities with minors, which is the only one we accept. */
export const JUDICIAL_RECORD_MODEL = '596.2';

export interface JudicialRecordExtract {
    firstName: string | null;
    lastName: string | null;
    birthDay: Date | null;

    /** The day the extract was drawn up, as its header prints it. */
    documentDate: Date | null;

    /** Names the model, as `596.2 - model bestemd voor de contacten met minderjarigen`. */
    purpose: string | null;

    /**
     * The date next to the blank marker, null when the extract does not carry that marker at all.
     * Which is the whole determination of blankness: a record that is not blank does not print it.
     */
    blankSince: Date | null;

    /**
     * Where FOD Justitie serves this document, printed at the foot of the extract - the same url its
     * QR-code encodes - and the day until which they will answer for it.
     *
     * Both or neither. They are read from one sentence, and a url that is not one we recognise is
     * worth nothing on its own: it ends up in a link a member clicks, so it is either the shape FOD
     * Justitie prints or it is null, never a string we pass on untested.
     */
    url: string | null;
    urlExpiry: Date | null;
}

/**
 * The url the extract prints and the day it stops being served, or null for both.
 *
 * The url is validated rather than trusted. It comes out of a document we did not author, and the
 * only thing we do with it is offer it to a member as a link - so a value that is not FOD Justitie's
 * own form is dropped along with its date rather than carried half-way.
 */
function readVerifiableUrl(lines: string[]): { url: string; urlExpiry: Date } | null {
    const printed = readDatedLabelledValue(lines, JUDICIAL_RECORD_LABELS.url);

    if (printed === null) {
        return null;
    }

    const url = readJudicialRecordExtractUrl(printed.value);

    return url === null ? null : { url, urlExpiry: printed.date };
}

/**
 * The values the checks are run on, read off the lines of the document.
 *
 * A field that does not resolve is null rather than an error: the check that needs it then fails
 * with its own reason, which says something useful, where one opaque "unreadable" for the whole
 * document would not.
 */
export function readJudicialRecordExtract(lines: string[]): JudicialRecordExtract {
    return {
        firstName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.firstName),
        lastName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.lastName),
        birthDay: parsePrintedDate(readLabelledValue(lines, JUDICIAL_RECORD_LABELS.birthDay)),
        documentDate: parsePrintedDate(readInlineLabelledValue(lines, JUDICIAL_RECORD_LABELS.documentDate)),
        purpose: readValueOnNextLine(lines, JUDICIAL_RECORD_LABELS.purpose),
        blankSince: readMarkerDate(lines, JUDICIAL_RECORD_BLANK_MARKERS),
        ...(readVerifiableUrl(lines) ?? { url: null, urlExpiry: null }),
    };
}
