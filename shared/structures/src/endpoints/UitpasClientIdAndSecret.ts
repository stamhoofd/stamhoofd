import { AutoEncoder, BooleanDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';

export class UitpasClientIdAndSecret extends AutoEncoder {
    @field({ decoder: StringDecoder })
    clientId: string;

    @field({ decoder: StringDecoder })
    clientSecret: string;

    @field({ decoder: BooleanDecoder })
    useTestEnv: boolean;

    static get placeholderClientSecret() {
        return '••••';
    }
}
