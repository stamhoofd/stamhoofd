/**
 * Builds a valid pdf of `pageCount` A4 pages, each one filled with a grey block and its own page
 * number. Tests generate their fixture with this instead of carrying a pdf file around, so no real
 * judicial record extract ever ends up in the repository.
 */
export function createTestPdf({ pageCount, width = 595, height = 842 }: { pageCount: number; width?: number; height?: number }): Uint8Array {
    // Object 1 is the catalog, 2 the page tree, 3 the font; every page then takes two objects, its
    // own dictionary and its content stream.
    const objects: string[] = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];

    const pageIds: number[] = [];

    for (let index = 0; index < pageCount; index++) {
        const pageId = 4 + index * 2;
        const contentId = pageId + 1;
        pageIds.push(pageId);

        const stream = [
            '0.85 0.85 0.85 rg',
            `20 20 ${width - 40} ${height - 40} re f`,
            '0 0 0 rg',
            `BT /F1 36 Tf 60 ${height - 120} Td (Pagina ${index + 1} van ${pageCount}) Tj ET`,
        ].join('\n');

        objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
        objects[contentId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    }

    objects[1] = `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (const [index, object] of objects.entries()) {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }

    const startxref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map(offset => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

    // Everything written above is ascii, so one character is one byte and the xref offsets hold.
    return Uint8Array.from(pdf, character => character.charCodeAt(0));
}
