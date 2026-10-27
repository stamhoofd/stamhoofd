import { AutoEncoder, StringDecoder, field } from '@common/encoding';

export class UitpasClientIdAndSecret extends AutoEncoder {
    @field({ decoder: StringDecoder })
    clientId: string;

    @field({ decoder: StringDecoder })
    clientSecret: string;

    static get placeholderClientSecret() {
        return '••••';
    }
}
