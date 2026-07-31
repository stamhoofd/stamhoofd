import { Formatter } from '@stamhoofd/utility';

/**
 * Styles for the printed document. This is a standalone document, so none of the app styles
 * (or css variables) are available here. Sizes are in pt because the output is paper.
 */
const printStyles = `
    html {
        color-scheme: light;
        background: #fff;
    }

    body {
        margin: 0;
        padding: 15mm;
        color: #000716;
        background: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    h1 {
        margin: 0 0 6pt;
        font-size: 18pt;
    }

    p {
        margin: 0 0 6pt;
        font-size: 10pt;
        line-height: 1.5;
        max-width: 130mm;
    }

    .date {
        color: #5e5e5e;
    }

    .codes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 60mm));
        gap: 4pt 8pt;
        margin-top: 10pt;
    }

    .codes code {
        padding: 5pt;
        border: 0.5pt solid #a0a0a0;
        border-radius: 3pt;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 12pt;
        text-align: center;
    }
`;

/**
 * Turns an empty document into a printable sheet with the recovery codes.
 */
export function renderRecoveryCodesDocument(doc: Document, codes: string[]) {
    const title = $t('%ZhY');
    doc.title = title;

    const style = doc.createElement('style');
    style.textContent = printStyles;
    doc.head.appendChild(style);

    const heading = doc.createElement('h1');
    heading.textContent = title;

    const description = doc.createElement('p');
    description.textContent = $t('%Zhc');

    const date = doc.createElement('p');
    date.className = 'date';
    date.textContent = $t('%ZiH', { date: Formatter.date(new Date(), true) });

    const list = doc.createElement('div');
    list.className = 'codes';

    for (const code of codes) {
        const element = doc.createElement('code');
        element.textContent = code;
        list.appendChild(element);
    }

    doc.body.append(heading, description, date, list);
}

/**
 * The last frame we printed. Kept around because removing it while the print dialog is
 * still open cancels the print job in some browsers.
 */
let printFrame: HTMLIFrameElement | null = null;

/**
 * Opens the print dialog of the browser with a sheet containing the recovery codes.
 *
 * Printing the page itself would also print the navigation bar, the toolbar and everything
 * behind this view, so we print an isolated document in a hidden iframe instead.
 */
export function printRecoveryCodes(codes: string[]) {
    printFrame?.remove();

    const frame = document.createElement('iframe');
    frame.title = $t('%ZhY');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('data-testid', 'recovery-codes-print-frame');
    frame.style.position = 'fixed';
    frame.style.top = '0';
    frame.style.left = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.style.visibility = 'hidden';

    document.body.appendChild(frame);
    printFrame = frame;

    // Only available after the frame is added to the document
    const frameWindow = frame.contentWindow;

    if (!frameWindow) {
        frame.remove();
        printFrame = null;
        throw new Error('Could not create a document to print');
    }

    renderRecoveryCodesDocument(frameWindow.document, codes);

    frameWindow.addEventListener('afterprint', () => {
        frame.remove();

        if (printFrame === frame) {
            printFrame = null;
        }
    }, { once: true });

    frameWindow.focus();
    frameWindow.print();
}
