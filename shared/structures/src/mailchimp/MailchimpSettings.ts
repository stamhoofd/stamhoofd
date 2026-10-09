import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

/**
 * The API key is never part of this structure: it only exists on the server.
 */
export class MailchimpSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    accountName = '';

    /**
     * Mailchimp datacenter prefix, e.g. 'us21'
     */
    @field({ decoder: StringDecoder })
    dataCenter = '';

    @field({ decoder: StringDecoder, nullable: true })
    audienceId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    audienceName: string | null = null;

    /**
     * Record that members use to opt in to the newsletter.
     * When set, only contacts with at least one linked member who opted in are added.
     */
    @field({ decoder: StringDecoder, nullable: true })
    newsletterRecordId: string | null = null;

    /**
     * For choice records: the choices that count as opting in
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    newsletterChoiceIds: string[] = [];

    /**
     * Records whose answers are sent to Mailchimp as tags
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    tagRecordIds: string[] = [];
}
