// Error that is caused by a client and should be reported to the client
export class DecodingError extends Error {
    code: string;
    message: string;
    human: string | undefined;
    field: string | undefined;

    constructor(error: { code: string; message: string; human?: string; field?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.field = error.field;
        this.human = error.human;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecodingError);
        }
    }
}
