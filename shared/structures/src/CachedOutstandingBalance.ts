import { ArrayDecoder, AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Organization } from './Organization';

export enum CachedOutstandingBalanceType {
    organization = 'organization',
    member = 'member',
    user = 'user',
}

export class CachedOutstandingBalanceObjectContact extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    name: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    emails: string[] = [];
}

export class CachedOutstandingBalanceObject extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    // E-mail addresses to reach out to this entity
    @field({ decoder: new ArrayDecoder(CachedOutstandingBalanceObjectContact) })
    contacts: CachedOutstandingBalanceObjectContact[] = [];
}

/**
 * An entity (organization, member or user) that has an outstanding balance towards an organization
 */
export class CachedOutstandingBalance extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(CachedOutstandingBalanceType) })
    objectType: CachedOutstandingBalanceType;

    @field({ decoder: CachedOutstandingBalanceObject })
    object: CachedOutstandingBalanceObject;

    /**
     * The organization that should receive the outstanding balance
     */
    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: IntegerDecoder })
    amount = 0;

    @field({ decoder: IntegerDecoder })
    amountPending = 0;
}
