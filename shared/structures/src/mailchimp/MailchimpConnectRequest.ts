import { AutoEncoder, field, StringDecoder } from '@stamhoofd/common-encoding';

export class MailchimpConnectRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    apiKey = '';
}
