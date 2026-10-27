import { Data, Encodeable, EncodeContext, PlainObject } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

// Error that is caused by a client and should be reported to the client
export class SimpleError extends Error implements Encodeable {
    id: string;
    code: string;
    message: string;
    human: string | undefined;
    field: string | undefined;

    /**
     * Assign special meta data to an error that can be used for special handling of errors.
     * This type is 'any', but use the decode methods to decode this first
     */
    meta: PlainObject | undefined;

    /**
    * Used to determine the associated HTTP status code when thrown in an endpoint
    */
    statusCode?: number;

    constructor(error: { code: string; message: string; human?: string; field?: string; statusCode?: number; id?: string; meta?: PlainObject }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;
        this.field = error.field;
        this.statusCode = error.statusCode;
        this.id = error.id ?? this.generateID();
        this.meta = error.meta;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SimpleError);
        }
    }

    toString(): string {
        return this.code + ': ' + this.message + (this.field ? ' at ' + this.field : '') + ' (' + this.id + ')';
    }

    /**
     * Required to override the default toJSON behaviour of Error
     */
    toJSON() {
        return this.encode({ version: 0 });
    }

    encode(context: EncodeContext) {
        return {
            id: this.id,
            code: this.code,
            message: this.message,
            human: this.human,
            field: this.field,
            meta: this.meta,
        };
    }

    static decode(data: Data): SimpleError {
        return new SimpleError({
            id: data.field('id').string,
            code: data.field('code').string,
            message: data.field('message').string,
            human: data.optionalField('human')?.string,
            field: data.optionalField('field')?.string,
            meta: data.optionalField('meta')?.value,
        });
    }

    hasCode(code: string): boolean {
        return this.code === code;
    }

    getCode(code: string): SimpleError | undefined {
        if (this.hasCode(code)) {
            return this;
        }
    }

    hasFieldThatStartsWith(prefix: string): boolean {
        return !!this.field && this.field.startsWith(prefix);
    }

    doesMatchFields(fields: string[]): boolean {
        for (const field of fields) {
            if (this.doesMatchField(field)) {
                return true;
            }
        }
        return false;
    }

    doesMatchField(field: string): boolean {
        if (!this.field) {
            return false;
        }

        return this.field.startsWith(field);
    }

    generateID(): string {
        return uuidv4() + '@' + new Date().getTime();
    }

    addNamespace(field: string) {
        this.field = this.field ? field + '.' + this.field : field;
    }

    /// Returns a human description of all the errors
    getHuman(): string {
        return this.human ?? this.message;
    }
}

export function isSimpleError(e: unknown): e is SimpleError {
    return e !== null && typeof e === 'object' && 'string' && 'code' in e && 'message' in e && typeof e.code === 'string' && typeof e.message === 'string' && 'encode' in e && 'doesMatchFields' in e && 'doesMatchField' in e;
}
