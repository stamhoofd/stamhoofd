/**
 * Reading specific values back out of the lines of a pdf. Every reader takes a list of accepted
 * spellings, so another wording - or the same field in French or German - is appended to the list
 * rather than handled in the matching. Matching ignores case and spacing, but not accents.
 */

/** A field written as `Label: value`, trying every accepted spelling. */
export function readLabelledValue(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(\\S.*)$`, 'iu');

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
 * A field whose label sits inside a longer line next to other fields, as a header printing a
 * reference, a date and a subject on one line. The value ends where the next label begins.
 *
 * Not at the wide gap the page sets those fields apart with: a field printed as `Naam :` with its
 * value in a second column has just as wide a gap, so splitting on it would take every value away
 * from its label.
 */
export function readInlineLabelledValue(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(label)}\\s*[:：]\\s*(\\S.*)$`, 'iu');

        for (const line of lines) {
            const tail = pattern.exec(line)?.[1];
            if (tail === undefined) {
                continue;
            }

            const value = takeUntilNextLabel(tail);
            if (value) {
                return value;
            }
        }
    }

    return null;
}

/** The `(?!\/\/)` keeps the colon of a url from reading as the next label. */
const NEXT_LABEL = /\s\p{L}[\p{L}\p{N}. ]*[:：](?!\/\/)/u;

function takeUntilNextLabel(tail: string): string {
    const next = NEXT_LABEL.exec(tail);
    const value = next === null ? tail : tail.slice(0, next.index);

    // Fields on one line are strung together with a dash or a comma, which is not part of the value
    return value.replace(/[\s\-–—,;]+$/u, '').trim();
}

/** A field whose value is printed on the line below its label, or behind it. */
export function readValueOnNextLine(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        // No `\s*` in front of the capture: it would hand the same whitespace to two quantifiers at
        // once, which is all polynomial backtracking needs. Trimmed below instead
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：](.*)$`, 'iu');

        for (const [index, line] of lines.entries()) {
            const match = pattern.exec(line);
            if (!match) {
                continue;
            }

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

/** `05/10/2026`, `5-10-2026`, `05.10.2026` - day first, as these documents are printed. */
const PRINTED_DATE = String.raw`\d{1,2}[-/.]\d{1,2}[-/.]\d{4}`;

/**
 * The date printed beside a marker that stands on a line of its own, as a document states something
 * about itself: `BLANCO STRAFREGISTER (05/10/2026)`. The marker has to open the line and the date to
 * close it, so the same words inside a paragraph do not answer. Parentheses and a leading colon are
 * optional.
 *
 * The date rather than a boolean, because a caller weighs it against the dates it holds from
 * elsewhere - when the pdf was signed, the date in its header - before taking the marker as an
 * answer.
 */
export function readMarkerDate(lines: string[], markers: readonly string[]): Date | null {
    for (const marker of markers) {
        // Both sides are collapsed first, so every gap is one space or none. ` ?` rather than `\s*`
        // keeps two quantifiers from trading the same whitespace
        const pattern = new RegExp(`^${escapeRegExp(collapseSpaces(marker))} ?:? ?\\(? ?(${PRINTED_DATE}) ?\\)?$`, 'iu');

        for (const line of lines) {
            const printed = pattern.exec(collapseSpaces(line))?.[1];
            const date = printed === undefined ? null : parsePrintedDate(printed);
            if (date) {
                return date;
            }
        }
    }

    return null;
}

/** Where a label template says the document prints a date inside the label itself. */
const DATE_PLACEHOLDER = '{date}';

/**
 * A statement carrying a date inside its own label, with the value it introduces behind the colon or
 * on the line below: `De authenticiteit van dit uittreksel kan tot 01/02/2027 gecontroleerd worden
 * via :` and then a url. The label is a template with `{date}` where the date is printed, once.
 *
 * Date and value come back together because read by two calls they could resolve against different
 * lines and disagree, with no way for a caller to notice. Here they are the pair printed on one
 * line, or nothing.
 */
export function readDatedLabelledValue(lines: string[], labels: readonly string[]): { date: Date; value: string } | null {
    for (const label of labels) {
        const [before, after] = collapseSpaces(label).split(DATE_PLACEHOLDER);

        // ` ?` rather than `\s*`, as in `readMarkerDate`
        const pattern = new RegExp(`^${escapeRegExp(before ?? '')} ?(${PRINTED_DATE}) ?${escapeRegExp(after ?? '')} ?[:：](.*)$`, 'iu');

        for (const [index, line] of lines.entries()) {
            const match = pattern.exec(collapseSpaces(line));
            if (!match) {
                continue;
            }

            // A date the calendar does not have means the sentence has not resolved
            const date = parsePrintedDate(match[1]);
            if (date === null) {
                continue;
            }

            const value = match[2].trim() || lines[index + 1]?.trim();
            if (value) {
                return { date, value };
            }
        }
    }

    return null;
}

/**
 * A printed date read day first, at midnight UTC: a printed date names a day and not a moment, so
 * two of them compare as days. Each separator is read on its own, so `5-10.2026` parses as well.
 *
 * Takes the null a reader hands back, so reading a date stays one call.
 */
export function parsePrintedDate(value: string | null | undefined): Date | null {
    const match = value === null || value === undefined ? null : /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$/u.exec(value);
    if (!match) {
        return null;
    }

    const [day, month, year] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Date.UTC rolls 31/02 over into March instead of refusing it
    if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year) {
        return null;
    }

    return date;
}

/** A pdf decides where its own whitespace goes, so a marker is matched against a single space. */
function collapseSpaces(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
