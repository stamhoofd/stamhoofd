import { SimpleError } from '@common/errors';

import { createMainThreadWorker, getDocument, VerbosityLevel } from './pdfjs.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;

/** Items closer together than this on the y axis belong to the same line. */
const LINE_TOLERANCE = 2;

/**
 * A malformed upload is answered with a SimpleError the member reads, so pdf.js writing its own
 * account of the same file to the console adds noise and no reader.
 */
const VERBOSITY = VerbosityLevel.ERRORS;

/** A text item of a page, reduced to what placing it on a line needs. */
interface TextItem {
    str: string;
    /** From the left of the page, in pdf units. */
    x: number;
    /** From the bottom of the page, in pdf units. */
    y: number;
    width: number;
    fontSize: number;
}

/**
 * The text of a pdf in reading order, one string per line.
 *
 * pdf.js emits text items in the order the file happens to draw them, so a label and its value can
 * arrive in either sequence.
 *
 * Throws a `SimpleError` when there is no text to return. Every one of them carries a `human`
 * message that says what to do about it, so a caller can pass it on to whoever uploaded the file
 * without having to map the code first.
 */
export async function extractPdfLines(data: Uint8Array): Promise<string[]> {
    if (data.byteLength === 0) {
        throw new SimpleError({
            code: 'invalid_pdf',
            message: 'Empty file.',
            human: $t('Dit bestand is leeg. Laad het document opnieuw op.'),
            statusCode: 400,
        });
    }

    if (data.byteLength > MAX_BYTES) {
        throw new SimpleError({
            code: 'pdf_too_large',
            message: `File larger than ${MAX_BYTES} bytes.`,
            human: $t('Dit bestand is te groot. Laad het originele document op, van maximaal {megabytes} MB.', { megabytes: Math.floor(MAX_BYTES / (1024 * 1024)).toString() }),
            statusCode: 400,
        });
    }

    const pages = await readPages(data);

    const lines: string[] = [];
    for (const items of pages) {
        lines.push(...groupItemsIntoLines(items));
    }

    if (lines.length === 0) {
        throw new SimpleError({
            code: 'pdf_without_text',
            message: 'This pdf has no text layer.',
            human: $t('Dit document bevat geen tekst. Een scan of een foto kunnen we niet lezen: laad het originele pdf-bestand op.'),
            statusCode: 400,
        });
    }

    return lines;
}

async function readPages(data: Uint8Array): Promise<TextItem[][]> {
    const { worker, close } = createMainThreadWorker(VERBOSITY);

    try {
        // pdf.js takes ownership of the buffer it is given, so it gets a copy of its own
        const pdf = await loadDocument(new Uint8Array(data), worker);

        try {
            if (pdf.numPages > MAX_PAGES) {
                throw new SimpleError({
                    code: 'pdf_too_many_pages',
                    message: `More than ${MAX_PAGES} pages.`,
                    human: $t('Dit document bevat te veel pagina\'s. Laad een document van maximaal {pages} pagina\'s op.', { pages: MAX_PAGES.toString() }),
                    statusCode: 400,
                });
            }

            return await extractItems(pdf);
        } finally {
            await pdf.loadingTask.destroy();
        }
    } finally {
        // pdf.js only tears down a worker it created itself, and this one was created here. The
        // channel has to be closed as well, or Node keeps the event loop alive on the open port
        worker.destroy();
        close();
    }
}

async function loadDocument(data: Uint8Array, worker: ReturnType<typeof createMainThreadWorker>['worker']) {
    try {
        return await getDocument({
            data,
            worker,
            verbosity: VERBOSITY,
            // This package reads text and never renders, so an untrusted document has no business
            // installing font faces into the page it is read on
            disableFontFace: true,
        }).promise;
    } catch (error) {
        throw new SimpleError({
            code: 'invalid_pdf',
            message: `Not a readable pdf: ${error instanceof Error ? error.message : 'unknown error'}.`,
            human: $t('Dit bestand is geen leesbare pdf. Laad het originele pdf-bestand op.'),
            statusCode: 400,
        });
    }
}

async function extractItems(pdf: Awaited<ReturnType<typeof loadDocument>>): Promise<TextItem[][]> {
    try {
        return await Promise.all(
            Array.from({ length: pdf.numPages }, (_, index) => readPageItems(pdf, index + 1)),
        );
    } catch (error) {
        throw new SimpleError({
            code: 'invalid_pdf',
            message: `Text extraction failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
            human: $t('We konden de tekst van dit bestand niet lezen. Laad het originele pdf-bestand op.'),
            statusCode: 400,
        });
    }
}

async function readPageItems(pdf: Awaited<ReturnType<typeof loadDocument>>, pageNumber: number): Promise<TextItem[]> {
    const page = await pdf.getPage(pageNumber);
    const { items } = await page.getTextContent();

    return items
        // A page also yields marked-content boundaries, which carry no text and no position
        .filter((item): item is Extract<typeof item, { str: string }> => 'str' in item)
        .map((item) => {
            // The text matrix: scale and skew first, then the position the item is drawn at
            const [, , skewX, scaleY, x, y] = item.transform as number[];

            return {
                str: item.str,
                x,
                y,
                width: item.width,
                // The drawn size of the glyphs, which the matrix may have scaled and skewed
                fontSize: Math.hypot(skewX, scaleY),
            };
        });
}

function groupItemsIntoLines(items: TextItem[]): string[] {
    const sorted = items
        .filter(item => item.str.trim().length > 0)
        // y descends from the top of the page, since the pdf origin is bottom-left
        .sort((a, b) => b.y - a.y);

    const lines: TextItem[][] = [];

    for (const item of sorted) {
        const line = lines[lines.length - 1];

        if (line && Math.abs(line[0].y - item.y) <= LINE_TOLERANCE) {
            line.push(item);
        } else {
            lines.push([item]);
        }
    }

    return lines
        .map(line => joinLine(line.sort((a, b) => a.x - b.x)))
        .filter(line => line.length > 0);
}

/** pdf.js splits a line at every style change, also in the middle of a word. */
function joinLine(items: TextItem[]): string {
    let line = '';
    let previousEnd: number | null = null;
    let previousFontSize = 0;

    for (const item of items) {
        const needsSpace = previousEnd !== null
            && !line.endsWith(' ')
            && !item.str.startsWith(' ')
            && item.x - previousEnd > Math.max(previousFontSize, item.fontSize) * 0.2;

        line += (needsSpace ? ' ' : '') + item.str;
        previousEnd = item.x + item.width;
        previousFontSize = item.fontSize;
    }

    return line.replace(/\s+/g, ' ').trim();
}
