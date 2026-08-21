import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

/**
 * The account of the administrator behind an impersonated session. Everything the session
 * changes is attributed to this account, not to the impersonated one.
 */
export class ImpersonatedBy extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    email: string;

    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    get name() {
        if (!this.lastName) {
            return this.firstName ?? '';
        }
        if (!this.firstName) {
            return this.lastName;
        }
        return this.firstName + ' ' + this.lastName;
    }
}

export class StartImpersonationRequest extends AutoEncoder {
    /**
     * The user to sign in as.
     */
    @field({ decoder: StringDecoder })
    userId: string;
}

export class ImpersonationTicket extends AutoEncoder {
    /**
     * One-time secret that can be traded for a session. Belongs in the fragment of the
     * link, never in the query string: a fragment is not sent to the server and does not
     * end up in referrers or server logs.
     */
    @field({ decoder: StringDecoder })
    ticket: string;

    @field({ decoder: DateDecoder })
    validUntil: Date;
}

export class ImpersonationTicketGrant extends AutoEncoder {
    @field({ decoder: StringDecoder })
    ticket: string;
}
