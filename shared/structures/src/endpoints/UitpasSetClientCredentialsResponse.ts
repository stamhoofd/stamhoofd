import { AutoEncoder, EnumDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { UitpasClientCredentialsStatus } from '../UitpasClientCredentialsStatus';

export class UitpasSetClientCredentialsResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(UitpasClientCredentialsStatus) })
    status: UitpasClientCredentialsStatus;

    @field({ decoder: StringDecoder, optional: true })
    human?: string;
}

export class UitpasGetClienIdResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    clientId: string;
}
