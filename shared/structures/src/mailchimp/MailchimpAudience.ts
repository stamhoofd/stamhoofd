import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@common/encoding';

export class MailchimpAudience extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: IntegerDecoder })
    memberCount = 0;
}
