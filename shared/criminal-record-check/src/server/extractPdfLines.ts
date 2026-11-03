import { extractTextItems, getDocumentProxy } from 'unpdf';
import { CriminalRecordParseError, CriminalRecordParseErrorCode } from './CriminalRecordParseError.js';

/**
 * The bytes are untrusted input, so parsing runs with hard limits of its own.
 */
export interface PdfParseLimits {
    maxBytes: number;
    maxPages: number;
    timeoutMs: number;
}

export const DEFAULT_PDF_PARSE_LIMITS: PdfParseLimits = {
    // An extract from FOD Justitie is a few hundred kilobytes
    maxBytes: 5 * 1024 * 1024,
    maxPages: 10,
    timeoutMs: 10 * 1000,
};

/** Items closer together than this on the y axis belong to the same line. */
const LINE_TOLERANCE = 2;

/**
 * Extract the text of a pdf in reading order, one string per line.
 *
 * pdf.js emits text items in generator order, not in reading order, so a label and its value can
 * arrive in either sequence. Items are grouped per page on their baseline y and sorted by x, which
 * is what every pattern in the parser relies on.
 */
export async function extractPdfLines(data: Uint8Array, limits: PdfParseLimits = DEFAULT_PDF_PARSE_LIMITS): Promise<string[]> {
    if (data.byteLength === 0) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, 'empty file');
    }

    if (data.byteLength > limits.maxBytes) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, `file larger than ${limits.maxBytes} bytes`);
    }

    const pages = await withTimeout(readPages(data, limits), limits.timeoutMs);

    const lines: string[] = [];
    for (const items of pages) {
        lines.push(...groupItemsIntoLines(items));
    }

    if (lines.length === 0) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.NoText, 'no text layer');
    }

    return lines;
}

type TextItem = Awaited<ReturnType<typeof extractTextItems>>['items'][number][number];

async function readPages(data: Uint8Array, limits: PdfParseLimits): Promise<TextItem[][]> {
    // pdf.js takes ownership of the buffer it is given, so it gets a copy of its own
    const pdf = await loadDocument(new Uint8Array(data));

    if (pdf.numPages > limits.maxPages) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, `more than ${limits.maxPages} pages`);
    }

    try {
        const { items } = await extractTextItems(pdf);
        return items;
    } catch (error) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, `text extraction failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

async function loadDocument(data: Uint8Array) {
    try {
        return await getDocumentProxy(data);
    } catch (error) {
        throw new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, error instanceof Error ? error.message : 'unknown error');
    }
}

function groupItemsIntoLines(items: TextItem[]): string[] {
    const sorted = items
        .filter(item => item.str.trim().length > 0)
        // y descends from the top of the page, since the PDF origin is bottom-left
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

/**
 * Join the items of one line, inserting a space where the items are visually separated. pdf.js
 * splits a line into items at every style change, also in the middle of a word.
 */
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new CriminalRecordParseError(CriminalRecordParseErrorCode.InvalidPdf, `parsing took longer than ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
