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
 * A field whose label sits inside a longer line, next to other fields - a header that prints a
 * reference, a date and a subject on one line. The value is what belongs to this label alone: it
 * ends where the next label on the line begins.
 *
 * The page sets those fields apart by a wide gap rather than by punctuation, but a gap cannot be
 * the rule here: a field printed as `Naam :` with its value in a second column is just as wide a
 * gap as the one before the next field, so splitting on it would take every value away from its
 * label. The next label is what actually ends a value, so that is what this looks for.
 *
 * The label still has to start a word, so `Datum` does not resolve against `Geboortedatum`.
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

/**
 * Where the next field of the same line starts: whitespace, a word, a colon. The colon of a url is
 * not one of those, so a value that is a link survives whole.
 */
const NEXT_LABEL = /\s\p{L}[\p{L}\p{N}. ]*[:：](?!\/\/)/u;

function takeUntilNextLabel(tail: string): string {
    const next = NEXT_LABEL.exec(tail);
    const value = next === null ? tail : tail.slice(0, next.index);

    // Fields on one line are strung together with a dash or a comma, which is not part of the value
    return value.replace(/[\s\-–—,;]+$/u, '').trim();
}

/**
 * A field whose value is printed on the line below its label. The label always ends with a colon,
 * which is also what keeps it from resolving against a longer word: `Finaliteit` does not answer
 * for `Finaliteitscode`.
 */
export function readValueOnNextLine(lines: string[], labels: readonly string[]): string | null {
    for (const label of labels) {
        // Everything behind the colon, trimmed below: a `\s*` in front of the capture would only
        // hand the same whitespace to two quantifiers at once, which is a backtracking trade
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：](.*)$`, 'iu');

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

/** `05/10/2026`, `5-10-2026`, `05.10.2026` - day first, as these documents are printed. */
const PRINTED_DATE = String.raw`\d{1,2}[-/.]\d{1,2}[-/.]\d{4}`;

/**
 * The date a marker is printed next to, when that marker stands where the document reserves for it.
 *
 * A document that states something about itself prints that statement as a heading of its own, with
 * the date it was established beside it - `BLANCO STRAFREGISTER (05/10/2026)`. So the marker has to
 * open its line and the date has to close it, with nothing else between them: the same words inside
 * a paragraph that merely mentions them do not answer here. The parentheses around the date are
 * optional, as is a colon in front of it.
 *
 * A marker is matched the way a label is: ignoring case and how the words are spaced, but with the
 * accents the document prints. A spelling that differs in those is another spelling, so it goes in
 * the list - which is what the list is for.
 *
 * Returning the date rather than a boolean is the point. It is the document's own word for when it
 * was drawn up, which a caller weighs against the dates it has from elsewhere - the moment the pdf
 * was signed, the date printed in its header - before taking the marker for an answer.
 */
export function readMarkerDate(lines: string[], markers: readonly string[]): Date | null {
    for (const marker of markers) {
        // Both sides are collapsed first, so every gap here is one space or none. Writing them as
        // ` ?` rather than `\s*` is what keeps two quantifiers from trading the same whitespace
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
 * A statement the document makes about itself that carries a date *inside* its label, with the
 * value it introduces behind the colon or on the line below - `De authenticiteit van dit uittreksel
 * kan tot 01/02/2027 gecontroleerd worden via :` and then a url.
 *
 * The label is given as a template with `{date}` where the document prints the date, once. A fixed
 * label cannot express this: the words on either side are boilerplate but the date between them is
 * not, so matching the sentence and reading its date are the same operation.
 *
 * Which is also why both come back together rather than from two calls. Read separately they could
 * resolve against different lines and disagree - a document that prints the sentence twice, or a
 * paragraph that mentions the same words - and a caller has no way to notice. Here they are either
 * the pair the document printed on one line, or nothing.
 *
 * The label has to open its line, as a statement about the whole document does, and the colon it
 * prints is required: the same words inside a sentence about them do not answer.
 */
export function readDatedLabelledValue(lines: string[], labels: readonly string[]): { date: Date; value: string } | null {
    for (const label of labels) {
        const [before, after] = collapseSpaces(label).split(DATE_PLACEHOLDER);

        // Both sides are collapsed first, so every gap is one space or none. ` ?` rather than `\s*`
        // is what keeps two quantifiers from trading the same whitespace between them
        const pattern = new RegExp(`^${escapeRegExp(before ?? '')} ?(${PRINTED_DATE}) ?${escapeRegExp(after ?? '')} ?[:：](.*)$`, 'iu');

        for (const [index, line] of lines.entries()) {
            const match = pattern.exec(collapseSpaces(line));
            if (!match) {
                continue;
            }

            // A date the calendar does not have is not a date, so the sentence has not resolved
            const date = parsePrintedDate(match[1]);
            if (date === null) {
                continue;
            }

            // A wording that prints the value behind the colon resolves as well as one below it
            const value = match[2].trim() || lines[index + 1]?.trim();
            if (value) {
                return { date, value };
            }
        }
    }

    return null;
}

/**
 * A date as a document prints it, read day first: `05/10/2026` is the fifth of October. Midnight
 * UTC, since a printed date names a day and not a moment, so two of them compare as days.
 *
 * A slash, a dash or a dot separates the parts, and each is read on its own, so `5-10.2026` is a
 * date here too. A document that mixes them within one date is not a thing we have seen; accepting
 * it costs nothing and sorting printed input into well- and badly-punctuated is not this function's
 * business.
 *
 * Null for anything that is not one, a day the month does not have included. It takes the null a
 * reader hands back as well, so reading a date is the one call and not a call plus a fallback.
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
