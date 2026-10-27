import { AutoEncoder, field, StringDecoder } from '@common/encoding';

export class SignupResponse extends AutoEncoder {
    /**
     * Token used to validate the code
     */
    @field({ decoder: StringDecoder })
    token: string;
}
