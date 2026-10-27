import { AutoEncoder, field, StringDecoder } from '@common/encoding';

export class MailchimpConnectRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    apiKey = '';
}
