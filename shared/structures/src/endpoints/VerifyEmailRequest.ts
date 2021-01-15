import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class VerifyEmailRequest extends AutoEncoder {
    /**
     * Token that the client received when creating the code or via email link (might decide to drop that last one)
     */
    @field({ decoder: StringDecoder })
    token: string;

    @field({ decoder: StringDecoder })
    code: string;
}
