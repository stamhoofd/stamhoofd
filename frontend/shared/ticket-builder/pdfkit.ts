import PDFDocument, * as pdfkit from 'pdfkit';
import Helvetica from 'pdfkit/standard-fonts/Helvetica';

// The browser build of pdfkit 0.20 no longer embeds standard fonts, while the PDFDocument
// constructor opens the default Helvetica font eagerly.
// @types/pdfkit 0.17 does not know the named exports added in pdfkit 0.20.
const { registerStdFonts } = pdfkit as unknown as { registerStdFonts: (...fonts: object[]) => void };
registerStdFonts(Helvetica);

export { PDFDocument };
