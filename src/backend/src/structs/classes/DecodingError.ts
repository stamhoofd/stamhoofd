// Error that is caused by a client and should be reported to the client
export class DecodingError extends Error {
    code: string;
    message: string;
    field: string | undefined;

    constructor(error: { code: string; message: string; field?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.field = error.field;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecodingError);
        }
    }
}
