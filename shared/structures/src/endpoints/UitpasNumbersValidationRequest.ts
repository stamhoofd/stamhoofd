import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class UitpasNumbersValidationRequest extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    uitpasNumbers: string[];
}
