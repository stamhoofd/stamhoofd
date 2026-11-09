/** The QR-code on an extract and the link printed in words at its foot are the same url. */
const JUDICIAL_RECORD_EXTRACT_URL = /^https:\/\/just-crimeviewer-ctz\.just\.fgov\.be\/record\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-CJCS$/;

/**
 * The link to an extract this value is, or null. Whitespace is dropped first, since QR readers,
 * clipboards and pdfs each bring their own along.
 *
 * Matching is not enough on its own: `$` also matches before a trailing newline, so the match is
 * rebuilt from the uuid and has to equal the value exactly.
 *
 * Shared by the scanner, the endpoint that fetches a document and the reading of the url an extract
 * prints, because a value one of them would reject should never reach another.
 */
export function readJudicialRecordExtractUrl(value: string): string | null {
    const url = value.trim();
    const match = JUDICIAL_RECORD_EXTRACT_URL.exec(url);

    if (!match) {
        return null;
    }

    const rebuilt = `https://just-crimeviewer-ctz.just.fgov.be/record/${match[1]}-CJCS`;
    return rebuilt === url ? rebuilt : null;
}
