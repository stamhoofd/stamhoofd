import { ArrayDecoder, Data, Encodeable, EncodeContext, PlainObject, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

export class UitpasNumbersGetDetailsRequest implements Encodeable {
    uitpasNumbers: string[];

    constructor(data: { uitpasNumbers: string[] }) {
        this.uitpasNumbers = data.uitpasNumbers;
    }

    static decode(data: Data): UitpasNumbersGetDetailsRequest {
        return new UitpasNumbersGetDetailsRequest({
            uitpasNumbers: data.field('uitpasNumbers').decode(UitpasNumbersDecoder),
        });
    }

    encode(_context: EncodeContext): PlainObject {
        return {
            uitpasNumbers: JSON.stringify(this.uitpasNumbers),
        };
    }
}

class UitpasNumbersDecoder {
    static decode(data: Data): string[] {
        const str = data.string;
        try {
            const decoded = JSON.parse(str);
            return (new ArrayDecoder(StringDecoder)).decode(data.clone({ data: decoded, field: data.currentField, context: data.context }));
        }
        catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                message: `Expected JSON at ${data.currentField}`,
                field: data.currentField,
            });
        }
    }
}
