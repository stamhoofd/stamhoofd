import { AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { StamhoofdFilterDecoder } from '../filters/FilteredRequest.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';

export enum MailchimpSyncType {
    Members = 'Members',
    Orders = 'Orders',
}

export class MailchimpSyncRequest extends AutoEncoder {
    @field({ decoder: new EnumDecoder(MailchimpSyncType) })
    type = MailchimpSyncType.Members;

    /**
     * Sync all members registered in the current period and clean up contacts that no longer match.
     * Filter and search are ignored. Only for members.
     */
    @field({ decoder: BooleanDecoder })
    full = false;

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    search: string | null = null;

    /**
     * Required for orders
     */
    @field({ decoder: StringDecoder, nullable: true })
    webshopId: string | null = null;

    /**
     * New contacts receive a confirmation email from Mailchimp (status 'pending')
     */
    @field({ decoder: BooleanDecoder })
    doubleOptIn = false;

    /**
     * Archive contacts that no longer match a registered member (full sync only)
     */
    @field({ decoder: BooleanDecoder })
    archiveRemoved = false;

    /**
     * The administrator confirmed they have permission to email these contacts.
     * Not required for members when a newsletter record is configured.
     */
    @field({ decoder: BooleanDecoder })
    confirmedConsent = false;
}
