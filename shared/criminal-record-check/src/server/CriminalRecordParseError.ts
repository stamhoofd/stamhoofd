/**
 * Why a document could not be parsed. All three resolve to an automatic rejection, so the wording
 * towards the member must not blame the member: an unsupported wording is far more likely than a
 * wrong document.
 */
export enum CriminalRecordParseErrorCode {
    /** Not a readable PDF (or beyond the limits we accept). */
    InvalidPdf = 'INVALID_PDF',
    /** No text layer: a scan or a photo saved as a PDF. */
    NoText = 'NO_TEXT',
    /** None of the mandatory fields resolved: an unsupported wording, another model, a tampered file. */
    UnrecognisedLayout = 'UNRECOGNISED_LAYOUT',
}

export class CriminalRecordParseError extends Error {
    readonly code: CriminalRecordParseErrorCode;

    constructor(code: CriminalRecordParseErrorCode, reason: string) {
        super(`${code}: ${reason}`);
        this.code = code;
    }
}
