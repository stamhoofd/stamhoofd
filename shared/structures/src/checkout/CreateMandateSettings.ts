import { AutoEncoder, BooleanDecoder, field } from '@simonbackx/simple-encoding';

export class CreateMandateSettings extends AutoEncoder {
    /**
     * Ignored if it is the only created mandate
     */
    @field({ decoder: BooleanDecoder, defaultValue: () => false })
    saveAsDefault = false;
}
