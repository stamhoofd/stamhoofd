// Error that is caused by a server and should be reported to the client
export class ServerError extends Error {
    code: string;
    message: string;
    human: string | undefined;

    constructor(error: { code: string; message: string; human?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ServerError);
        }
    }
}
