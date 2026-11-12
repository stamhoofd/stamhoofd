/** A minimal pdf with a text layer, so these tests can read a real pdf rather than a list of lines. */
export interface TestPdfLine {
    text: string;
    /** From the left of the page, in pdf units. */
    x?: number;
    /** From the bottom of the page, in pdf units. */
    y: number;
}

export function createTestPdf(lines: TestPdfLine[], options: { pages?: number } = {}): Uint8Array {
    const pageCount = options.pages ?? 1;
    const content = 'BT /F1 11 Tf\n'
        + lines.map(line => `1 0 0 1 ${line.x ?? 50} ${line.y} Tm (${escapePdfText(line.text)}) Tj`).join('\n')
        + '\nET';

    const objects: string[] = [];
    const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index);

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);

    const fontId = 3 + pageCount;
    const contentId = fontId + 1;

    for (let page = 0; page < pageCount; page++) {
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    }

    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    return assemblePdf(objects);
}

/** One empty page, like a scan saved as a pdf. */
export function createTestPdfWithoutText(): Uint8Array {
    return assemblePdf([
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>',
    ]);
}

function assemblePdf(objects: string[]): Uint8Array {
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (const [index, object] of objects.entries()) {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

function escapePdfText(text: string): string {
    return text.replace(/([\\()])/g, '\\$1');
}
