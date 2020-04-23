import { Data } from '@stamhoofd-common/encoding';

// Error that is caused by a client and should be reported to the client
export class ClientError extends Error {
    code: string;
    message: string;
    human: string | undefined;
    field: string | undefined;

    constructor(error: { code: string; message: string; human?: string; field?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;
        this.field = error.field;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ClientError);
        }
    }

    toString(): string {
        return this.code+": "+this.message+(this.field ? " at "+this.field : "");
    }

    /**
     * Required to override the default toJSON behaviour of Error
     */
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            human: this.human, 
            field: this.field
        }
    }

    static decode(data: Data): ClientError {
        return new ClientError({
            code: data.field("code").string,
            message: data.field("message").string,
            human: data.optionalField("human")?.string,
            field: data.optionalField("field")?.string,
        })
    }
}
