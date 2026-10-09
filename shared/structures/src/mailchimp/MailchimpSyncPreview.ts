import { AutoEncoder, BooleanDecoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

export class MailchimpSyncPreview extends AutoEncoder {
    /**
     * Unique email addresses that will be sent to Mailchimp
     */
    @field({ decoder: IntegerDecoder })
    contacts = 0;

    /**
     * No linked member opted in via the newsletter record
     */
    @field({ decoder: IntegerDecoder })
    withoutConsent = 0;

    /**
     * Unsubscribed in Stamhoofd: never added, existing contacts get unsubscribed
     */
    @field({ decoder: IntegerDecoder })
    unsubscribed = 0;

    /**
     * Invalid, bounced or marked as spam
     */
    @field({ decoder: IntegerDecoder })
    blocked = 0;

    @field({ decoder: BooleanDecoder })
    usesNewsletterRecord = false;
}
