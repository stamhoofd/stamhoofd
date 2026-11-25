import type { PdfText, PdfTextLine } from '@stamhoofd/pdf-parse';

/** An extract is one page. A second one is content we have no template for. */
const EXPECTED_PAGE_COUNT = 1;

/** Every value below is printed on the first one. */
const FIRST_PAGE = 1;

/**
 * In pdf units. The template sets its field lines 14 units apart and prints every value at a whole
 * number, so this absorbs a nudged baseline without ever reaching the line above or below.
 */
const POSITION_TOLERANCE = 2;

const FONT_SIZE_TOLERANCE = 0.5;

interface ExpectedLine {
    pattern: RegExp;

    /** The left edge, in pdf units from the left of the page. */
    x: number;

    /** The baseline, in pdf units from the bottom of the page. */
    y: number;

    fontSize: number;
}

/**
 * Where FOD Justitie prints the values an extract is checked on, and how big, measured off issued
 * extracts. Every value a check reads is here: a document that prints one of them somewhere else is
 * not the template these checks were written against, whatever its text says.
 *
 * These spellings are deliberately not taken from `JUDICIAL_RECORD_LABELS`. That list is open to
 * another wording - a second Dutch variant, the French and German equivalents - and the geometry of
 * a wording we have never seen is not something we can claim to know. A document in another
 * language fails this, which is the safe direction.
 */
const EXPECTED_LINES: readonly ExpectedLine[] = [
    { pattern: /^Ref\. doc\s*:/i, x: 38, y: 796, fontSize: 8 },
    { pattern: /^Uittreksel uit het strafregister$/i, x: 36, y: 603, fontSize: 16 },
    { pattern: /^Naam\s*:/i, x: 36, y: 573, fontSize: 10 },
    { pattern: /^Voorna\(a\)m\(en\)\s*:/i, x: 36, y: 559, fontSize: 10 },
    { pattern: /^Geboortedatum\s*:/i, x: 36, y: 545, fontSize: 10 },
    { pattern: /^Finaliteit van het uittreksel\s*:$/i, x: 36, y: 473, fontSize: 10 },
    { pattern: /^596\.2\s/, x: 36, y: 460, fontSize: 9 },
    { pattern: /^De authenticiteit van dit uittreksel/i, x: 34, y: 157, fontSize: 8 },
    { pattern: /^https:\/\/just-crimeviewer/i, x: 34, y: 149, fontSize: 8 },
];

/**
 * The empty record marker, which the template prints as a heading over the width of the page at
 * twice the size of the fields above it - the date beside it is smaller, and a line answers the
 * largest font size on it. Its own expectation, because it is the one line that carries the
 * determination.
 */
const EXPECTED_MARKER_LINE: ExpectedLine = { pattern: /^BLANCO STRAFREGISTER/i, x: 125, y: 352, fontSize: 20 };

export interface JudicialRecordLayout {
    /** The document holds more pages than the one this template has. */
    hasUnexpectedPageCount: boolean;

    /** A value a check reads is not printed where, or not as large as, this template prints it. */
    hasUnexpectedPositions: boolean;

    /** The empty record marker is not printed where, or not as large as, this template prints it. */
    hasUnexpectedMarker: boolean;
}

/**
 * Whether the document is laid out as an extract of FOD Justitie.
 *
 * What a document says is one thing; that it says it in the place and the size the issuer prints it
 * is another, and the second is what a document we have no template for cannot imitate by accident.
 * The marker is reported separately from the rest: it is the line the empty record check rests on,
 * and the other values belong to the question whether this is the right kind of document at all.
 */
export function readJudicialRecordLayout(text: PdfText): JudicialRecordLayout {
    return {
        hasUnexpectedPageCount: text.pageCount > EXPECTED_PAGE_COUNT,
        hasUnexpectedPositions: !EXPECTED_LINES.every(expected => isPrintedOnlyAt(text.lines, expected)),
        hasUnexpectedMarker: !isPrintedOnlyAt(text.lines, EXPECTED_MARKER_LINE),
    };
}

/**
 * Printed once and in its place. Once, because a second line carrying the same words is a document
 * saying something twice, and we would have no way to tell which of the two a check just read.
 */
function isPrintedOnlyAt(lines: readonly PdfTextLine[], expected: ExpectedLine): boolean {
    const printed = lines.filter(line => expected.pattern.test(line.text));

    return printed.length === 1 && isAt(printed[0], expected);
}

function isAt(line: PdfTextLine, expected: ExpectedLine): boolean {
    return line.page === FIRST_PAGE
        && Math.abs(line.x - expected.x) <= POSITION_TOLERANCE
        && Math.abs(line.y - expected.y) <= POSITION_TOLERANCE
        && Math.abs(line.fontSize - expected.fontSize) <= FONT_SIZE_TOLERANCE;
}
