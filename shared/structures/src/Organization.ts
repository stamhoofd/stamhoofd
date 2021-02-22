import { ArrayDecoder,AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Address } from './addresses/Address';
import { Group } from './Group';
import { GroupCategory, GroupCategoryTree } from './GroupCategory';
import { OrganizationMetaData } from './OrganizationMetaData';
import { OrganizationPrivateMetaData } from './OrganizationPrivateMetaData';
import { Webshop, WebshopPreview } from './webshops/Webshop';

export class OrganizationKey extends AutoEncoder {
    @field({ decoder: StringDecoder })
    publicKey: string;

    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder, nullable: true })
    end: Date | null = null;
}

export class OrganizationKeyUser extends OrganizationKey {
    @field({ decoder: BooleanDecoder })
    hasAccess = false;
}

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

    /**
     * All the available groups are listed here. They are only 'active' and visible when inside a category. Please remove them here if they are inactive.
     * Deleting a group will also trigger database deletion.
     */
    @field({ decoder: new ArrayDecoder(Group), version: 2, upgrade: () => [] })
    groups: Group[] = []

    /**
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    get categoryTree(): GroupCategoryTree {
        const root = this.meta.categories.find(c => c.id === this.meta.rootCategoryId)
        if (root) {
            return GroupCategoryTree.build(root, this.meta.categories, this.groups)
        }

        // Broken setup here
        console.warn("Root category ID is missing in categories. Migration might be needed")
        return GroupCategoryTree.create({ })
    }

    /**
     * Only set for users with full access to the organization
     */
    @field({ decoder: OrganizationPrivateMetaData, nullable: true, version: 6})
    privateMeta: OrganizationPrivateMetaData | null = null;

    /**
     * Only set for users with full access to the organization
     */
    @field({ decoder: new ArrayDecoder(WebshopPreview), version: 38, upgrade: () => []})
    webshops: WebshopPreview[] = [];
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

export class OrganizationWithWebshop extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization

    @field({ decoder: Webshop })
    webshop: Webshop
}

export const OrganizationPatch = Organization.patchType()