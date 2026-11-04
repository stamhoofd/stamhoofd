/**
 * Reading specific text back out of the lines of a pdf. Which labels a document prints its fields
 * behind is the caller's business; how a line has to be taken apart to find a value is this
 * package's.
 *
 * Every function takes a list of accepted spellings rather than one, so another wording - a second
 * variant in the same language, or the equivalent in another one - can be appended without touching
 * the matching.
 */

/** A field written as `Label: value`, trying every accepted spelling. */
export function readLabelledValue(lines: string[], labels: readonly string[]): string | null {
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
 * A field whose label sits inside a longer line, next to other fields - a header that prints a
 * reference, a date and a subject on one line. The value is everything behind the label, up to the
 * end of the line, so the caller takes from it what it needs.
 *
 * The label still has to start a word, so `Datum` does not resolve against `Geboortedatum`.
 */
export function readInlineLabelledValue(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(label)}\\s*[:：]\\s*(\\S.*)$`, 'iu');

        for (const line of lines) {
            const value = pattern.exec(line)?.[1].trim();
            if (value) {
                return value;
            }
        }
    }

    return null;
}

/** A field whose value is printed on the line below its label. */
export function readValueOnNextLine(lines: string[], labels: readonly string[]): string | null {
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

/**
 * Whether one of these markers is literally printed somewhere, ignoring case, accents and how the
 * words are spaced - a pdf decides where its own whitespace goes.
 */
export function containsText(lines: string[], markers: readonly string[]): boolean {
    return lines.some(line => markers.some(marker => normalize(line).includes(normalize(marker))));
}

function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
