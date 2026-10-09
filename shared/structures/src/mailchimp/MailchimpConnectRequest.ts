import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class MailchimpConnectRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    apiKey = '';
}
