import { AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationPaymentMandateDetails extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    consumerName?: string;

    @field({ decoder: StringDecoder, optional: true })
    consumerAccount?: string;

    @field({ decoder: StringDecoder, optional: true })
    consumerBic?: string;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    cardExpiryDate: string | null = null;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    cardLabel: string | null = null;
}

export class OrganizationPaymentMandate extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: BooleanDecoder, optional: true })
    isDefault = false;

    @field({ decoder: StringDecoder })
    method: 'directdebit' | 'creditcard' | 'paypal';

    @field({ decoder: StringDecoder })
    status: 'valid' | 'pending' | 'invalid';

    @field({ decoder: OrganizationPaymentMandateDetails })
    details: OrganizationPaymentMandateDetails;

    /**
     * The signature date of the mandate in YYYY-MM-DD format.
     */
    @field({ decoder: StringDecoder, nullable: true })
    signatureDate: string | null = null;

    /**
     * The mandate’s date and time of creation, in ISO 8601 format.
     */
    @field({ decoder: DateDecoder })
    createdAt: Date;

    @field({ decoder: StringDecoder, nullable: true })
    mandateReference: string | null = null;
}
