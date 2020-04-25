import { Data } from '@stamhoofd-common/encoding';

import { STError } from "./STError";

// Error that is caused by a client and should be reported to the client
export class STErrors extends Error {
    errors: STError[];

    constructor(...errors: STError[]) {
        super(errors.map(e => e.toString()).join("\n"));
        this.errors = errors;
    }

    addError(error: STError | STErrors) {
        if (error instanceof STError) {
            this.errors.push(error);
            this.message += "\n" + error.toString();
        } else if (error instanceof STErrors) {
            this.errors.push(...error.errors)
            this.message += "\n" + error.toString();
        } else {
            throw new Error("Unsupported addError")
        }
    }

    get statusCode(): number | undefined {
        return this.errors.find(e => e.statusCode !== undefined)?.statusCode
    }

    removeErrorAt(index: number) {
        this.errors.splice(index, 1)
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

    static decode(data: Data): STErrors {
        return new STErrors(...data.field("errors").array(STError))
    }

    throwIfNotEmpty() {
        if (this.errors.length > 0) {
            throw this;
        }
    }

    generateIds() {
        for (const error of this.errors) {
            error.generateId()
        }
    }
}
