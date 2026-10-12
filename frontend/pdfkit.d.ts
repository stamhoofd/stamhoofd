// pdfkit >= 0.20 standard font metrics, which @types/pdfkit does not declare yet
declare module 'pdfkit/standard-fonts/Helvetica' {
    const font: object;
    export default font;
}
