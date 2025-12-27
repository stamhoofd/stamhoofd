import { AutoEncoder, BooleanDecoder, field } from '@simonbackx/simple-encoding';

export class UitpasNumbersValidationResponse extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    areValid = false;
}
