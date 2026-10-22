import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class IDDeleteRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    registrationId: string;
}
