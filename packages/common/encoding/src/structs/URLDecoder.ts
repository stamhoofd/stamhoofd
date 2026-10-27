import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

export class URLDecoder implements Decoder<URL> {
    allowedProtocols = ['https:'];
    allowPorts = false;

    constructor(options?: { allowedProtocols?: string[]; allowPorts?: boolean }) {
        this.allowedProtocols = options?.allowedProtocols ?? this.allowedProtocols;
        this.allowPorts = options?.allowPorts ?? this.allowPorts;
    }

    decode(data: Data): URL {
        const str = data.string;

        try {
            const parsed = new URL(str);

            if (!this.allowedProtocols.includes(parsed.protocol)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a valid URL at ${data.currentField} with protocol ${this.allowedProtocols.join(', ')}`,
                    field: data.currentField,
                });
            }

            if (!this.allowPorts && parsed.port !== '') {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a valid URL without custom port at ${data.currentField}`,
                    field: data.currentField,
                });
            }

            if (parsed.username || parsed.password) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a valid URL without username:password at ${data.currentField}`,
                    field: data.currentField,
                });
            }

            return parsed;
        }
        catch (e) {
            if (!isSimpleError(e) && !isSimpleErrors(e)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: `Expected a valid URL at ${data.currentField}`,
                    field: data.currentField,
                });
            }
            throw e;
        }
    }
}

// Fix encoding of urls
declare global {
    interface URL {
        encode: (context: EncodeContext) => string;
    }
}

URL.prototype.encode = function (this: URL, context: EncodeContext): string {
    return this.href;
};
