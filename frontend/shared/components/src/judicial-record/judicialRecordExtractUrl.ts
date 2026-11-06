/**
 * The link behind the QR-code that FOD Justitie prints on an extract. It is the only thing the
 * scanner and the paste field accept, and the same expression the endpoint validates with.
 */
const JUDICIAL_RECORD_EXTRACT_URL = /^https:\/\/just-crimeviewer-ctz\.just\.fgov\.be\/record\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-CJCS$/;

/**
 * The link to an extract this value is, or null. Surrounding whitespace is dropped first, since some
 * QR readers append a newline and a pasted link brings along whatever was on the clipboard.
 *
 * Matching is not enough on its own: `$` also matches before a trailing newline, so the match is
 * rebuilt and has to equal the value exactly. The endpoint does the same, and a value it would
 * reject should never be sent to it.
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
