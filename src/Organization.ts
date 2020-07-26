import { ArrayDecoder,AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Address } from './Address';
import { Group } from './Group';
import { OrganizationMetaData } from './OrganizationMetaData';
import { OrganizationPrivateMetaData } from './OrganizationPrivateMetaData';

export class Organization extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder, nullable: true, version: 3, upgrade: () => null })
    website: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 3, upgrade: () => null })
    registerDomain: string | null = null;

    @field({ decoder: StringDecoder, version: 3, upgrade: () => "" })
    uri: string;

    @field({ decoder: OrganizationMetaData })
    meta: OrganizationMetaData;

    @field({ decoder: Address })
    address: Address;

    @field({ decoder: StringDecoder })
    publicKey: string;

    @field({ decoder: new ArrayDecoder(Group), version: 2, upgrade: () => [] })
    groups: Group[] = []

    /**
     * Only set for users with full access to the organization
     */
    @field({ decoder: OrganizationPrivateMetaData, nullable: true })
    privateMeta: OrganizationPrivateMetaData | null;
}

export class OrganizationSimple extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: Address })
    address: Address;
}

export const OrganizationPatch = Organization.patchType()