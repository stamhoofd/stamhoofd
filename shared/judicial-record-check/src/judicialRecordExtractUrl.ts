/**
 * The link behind the QR-code that FOD Justitie prints on an extract, which is also the link printed
 * in words at its foot: the two are the same url. It is the only thing the scanner, the paste field
 * and the endpoint that fetches a document accept.
 */
const JUDICIAL_RECORD_EXTRACT_URL = /^https:\/\/just-crimeviewer-ctz\.just\.fgov\.be\/record\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-CJCS$/;

/**
 * The link to an extract this value is, or null. Surrounding whitespace is dropped first, since some
 * QR readers append a newline, a pasted link brings along whatever was on the clipboard, and a link
 * read out of a pdf brings along however that pdf spaced it.
 *
 * Matching is not enough on its own: `$` also matches before a trailing newline, so the match is
 * rebuilt from the uuid and has to equal the value exactly. Every caller does the same, and a value
 * one of them would reject should never reach another.
 *
 * It lives here rather than beside any one caller because three of them need the same answer - the
 * scanner, the endpoint that fetches a document, and the reading of the url an extract prints. The
 * last of those is why it cannot be frontend-only: a url read out of a document we did not author is
 * untrusted input, and it ends up in a link a member clicks.
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
