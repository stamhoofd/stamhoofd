import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class SignupResponse extends AutoEncoder {
    /**
     * Token used to validate the code
     */
    @field({ decoder: StringDecoder })
    token: string;
}
