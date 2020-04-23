import { ClientError } from "./ClientError";

// Error that is caused by a client and should be reported to the client
export class ClientErrors extends Error {
    errors: ClientError[];

    constructor(...errors: ClientError[]) {
        super(errors.map(e => e.message).join("\n"));
        this.errors = errors;
    }

    addError(error: ClientError) {
        this.errors.push(error);
        this.message += "\n" + error.message;
    }

    addNamespace(field: string) {
        this.errors.forEach(e => {
            e.field = e.field ? e.field + "." + field : field;
        });
    }

    /**
     * Required to override the default toJSON behaviour of Error
     */
    toJSON() {
        return {
            errors: this.errors
        }
    }
}
