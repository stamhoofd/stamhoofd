import { Data } from '@stamhoofd-common/encoding';

// Error that is caused by a client and should be reported to the client
export class STError extends Error {
    code: string;
    message: string;
    human: string | undefined;
    field: string | undefined;
    statusCode?: number

    constructor(error: { code: string; message: string; human?: string; field?: string; statusCode?: number }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;
        this.field = error.field;
        this.statusCode = error.statusCode

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, STError);
        }
    }

    toString(): string {
        return this.code + ": " + this.message + (this.field ? " at " + this.field : "");
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

    static decode(data: Data): STError {
        return new STError({
            code: data.field("code").string,
            message: data.field("message").string,
            human: data.optionalField("human")?.string,
            field: data.optionalField("field")?.string,
        })
    }

    doesMatchFields(fields: string[]): boolean {
        for (const field of fields) {
            if (this.doesMatchField(field)) {
                return true
            }
        }
        return false
    }

    doesMatchField(field: string): boolean {
        if (!this.field) {
            return false
        }

        return (this.field.startsWith(field));
    }
}
