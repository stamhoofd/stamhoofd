import { parsePrintedDate, readDatedLabelledValue, readInlineLabelledValue, readLabelledValue, readMarkerDate, readValueOnNextLine } from '@stamhoofd/pdf-parse';
import { readJudicialRecordExtractUrl } from './judicialRecordExtractUrl.js';

/**
 * What an extract of FOD Justitie prints its fields behind, as a list of accepted spellings each -
 * so the French and German equivalents can be appended without touching anything else. There is no
 * language detection: a field either resolves or it is null.
 */
export const JUDICIAL_RECORD_LABELS = {
    lastName: ['Naam', 'Familienaam'],
    firstName: ['Voorna(a)m(en)', 'Voornaam', 'Voornamen'],
    birthDay: ['Geboortedatum'],
    /** Printed in the header, next to the reference and the subject, not on a line of its own. */
    documentDate: ['Datum'],
    /** The value sits on the line below the label. */
    purpose: ['Finaliteit van het uittreksel'],
    /**
     * The sentence an extract closes with, with the url on the line below. The date sits inside the
     * label, so the wording is a template with `{date}` where the document prints it.
     */
    url: ['De authenticiteit van dit uittreksel kan tot {date} gecontroleerd worden via'],
} as const;

/** The document's own heading for an empty record, with the date it was established beside it. */
export const JUDICIAL_RECORD_EMPTY_RECORD_MARKERS = ['BLANCO STRAFREGISTER'];

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
     * The date beside the empty record marker, null when the extract does not carry the marker -
     * which is the whole determination: a record that is not empty does not print it.
     */
    emptyRecordSince: Date | null;

    /** Both or neither: they are read from one sentence. */
    url: string | null;
    urlExpiry: Date | null;
}

/**
 * The url is validated rather than trusted. It comes out of a document we did not author and ends up
 * in a link a member clicks, so a value that is not FOD Justitie's own form is dropped along with its
 * date rather than carried half-way.
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
 * A field that does not resolve is null rather than an error, so the check that needs it fails with
 * its own reason - where one opaque "unreadable" for the whole document would say nothing useful.
 */
export function readJudicialRecordExtract(lines: string[]): JudicialRecordExtract {
    return {
        firstName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.firstName),
        lastName: readLabelledValue(lines, JUDICIAL_RECORD_LABELS.lastName),
        birthDay: parsePrintedDate(readLabelledValue(lines, JUDICIAL_RECORD_LABELS.birthDay)),
        documentDate: parsePrintedDate(readInlineLabelledValue(lines, JUDICIAL_RECORD_LABELS.documentDate)),
        purpose: readValueOnNextLine(lines, JUDICIAL_RECORD_LABELS.purpose),
        emptyRecordSince: readMarkerDate(lines, JUDICIAL_RECORD_EMPTY_RECORD_MARKERS),
        ...(readVerifiableUrl(lines) ?? { url: null, urlExpiry: null }),
    };
}
