import { PdfDocWrapper } from './pdf-doc-wrapper';
import { PdfText, PdfTextOptions } from './pdf-items';

/**
 * Draw a page number on each page
 * @param docWrapper
 * @param title title to be shown next to the page number
 * @param textOptions text options for the page number
 */
export function drawPageNumbers(docWrapper: PdfDocWrapper, title: string, textOptions: PdfTextOptions) {
    const doc = docWrapper.doc;

    const range = doc.bufferedPageRange();
    const end = range.start + range.count;

    if (range.count > 1) {
        // loop pages
        for (let i = range.start; i < end; i++) {
            const page = doc.switchToPage(i);

            // create page number text
            const text = title + ` - ${i + 1} / ${range.count}`;
            const width = docWrapper.getPageWidthWithoutMargins();
            const textItem = new PdfText(text, { ...textOptions, width });

            // store original margins
            const originalMargins = page.margins;

            // remove margins (otherwise the page numbers will overflow)
            page.margins = {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            };

            // draw page number
            textItem.draw(docWrapper, {
                position: {
                    x: originalMargins.left,
                    y: page.height - originalMargins.bottom,
                },
                maxWidth: width,
            });

            // add original margins again
            page.margins = originalMargins;
        }
    }
}
