import { AutoEncoder, BooleanDecoder, field } from '@stamhoofd/common-encoding';

export class CreateMandateSettings extends AutoEncoder {
    /**
     * Ignored if it is the only created mandate
     */
    @field({ decoder: BooleanDecoder, defaultValue: () => false })
    saveAsDefault = false;
}
