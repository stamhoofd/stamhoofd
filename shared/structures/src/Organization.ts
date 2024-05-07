import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Address } from './addresses/Address';
import { Group } from './Group';
import { GroupCategorySettings, GroupCategoryTree } from './GroupCategory';
import { OrganizationMetaData } from './OrganizationMetaData';
import { OrganizationPrivateMetaData } from './OrganizationPrivateMetaData';
import { User } from './User';
import { UserPermissions } from './UserPermissions';
import { Webshop, WebshopPreview } from './webshops/Webshop';

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

    @field({ decoder: OrganizationMetaData, defaultValue: () => OrganizationMetaData.create({}) })
    meta: OrganizationMetaData;

    @field({ decoder: Address })
    address: Address;

    /**
     * All the available groups are listed here. They are only 'active' and visible when inside a category. Please remove them here if they are inactive.
     * Deleting a group will also trigger database deletion.
     */
    @field({ decoder: new ArrayDecoder(Group), version: 2, upgrade: () => [], optional: true })
    groups: Group[] = []

    /**
     * Get all groups that are in a category
     */
    get availableGroups() {
        return this.categoryTree.getAllGroups()
    }

    getGroupsForPermissions(permissions?: UserPermissions | null) {
        return this.getCategoryTree({permissions}).getAllGroups()
    }

    get adminAvailableGroups() {
        return this.adminCategoryTree.getAllGroups()
    }

    /**
     * Get all groups that are in a category
     */
    get availableCategories() {
        return this.adminCategoryTree.getAllCategories()
    }
    
    /**
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    get categoryTree(): GroupCategoryTree {
        return this.getCategoryTree()
    }

    get publicCategoryTree(): GroupCategoryTree {
        return this.getCategoryTree({smartCombine: true})
    }

    get adminCategoryTree(): GroupCategoryTree {
        return this.getCategoryTree({admin: true})
    }

    isAcceptingNewMembers(admin: boolean) {
        const allGroups = this.adminAvailableGroups // we need to check admin groups because required groups could be restricted to internal groups
        const groups = this.getCategoryTree({admin}).getAllGroups()
        
        for (const group of groups) {
            if (group.closed) {
                continue;
            }
            if (group.settings.requireGroupIds.length > 0 && group.settings.requireGroupIds.find(id => !!allGroups.find(g => g.id === id))) {
                continue;
            }
            if (group.settings.requirePreviousGroupIds.length > 0 && group.settings.requirePreviousGroupIds.find(id => !!allGroups.find(g => g.id === id))) {
                continue;
            }
            if  (group.settings.availableMembers === 0 && !group.settings.waitingListIfFull) {
                continue;
            }
            return true;
        }
        return false;
    }

    isAcceptingExistingMembers(admin: boolean) {
        const groups = this.getCategoryTree({admin}).getAllGroups()
        
        for (const group of groups) {
            if (group.closed) {
                continue;
            }
            if  (group.settings.availableMembers === 0 && !group.settings.waitingListIfFull) {
                continue;
            }
            return true;
        }
        return false;
    }

    /**
     * @deprecated
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    categoryTreeForPermissions(permissions: UserPermissions): GroupCategoryTree {
        return this.getCategoryTree({permissions})
    }

    /**
     * Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     * 
     * For registration members perspective, try to use options.admin instead of options.permissions. 
     * options.permissions is only used if you want to hide groups and empty categories that you don't have permissions for.
     */
    getCategoryTree(options?: {maxDepth?: number, filterGroups?: (group: Group) => boolean, permissions?: UserPermissions | null, smartCombine?: boolean, admin?: boolean}): GroupCategoryTree {
        const root = this.meta.categories.find(c => c.id === this.meta.rootCategoryId)
        if (root) {
            let tree = GroupCategoryTree.build(root, this, {
                groups: options?.filterGroups ? this.groups.filter(options.filterGroups) : undefined,
                permissions: options?.permissions, 
                maxDepth: options?.maxDepth, 
                smartCombine: options?.smartCombine
            })

            if (!options?.permissions) {
                // Hide non public items
                tree = tree.filterForDisplay(options?.admin ?? false, this.meta.packages.useActivities || options?.admin, options?.smartCombine)
            }

            if (tree.categories.length == 0 && tree.groups.length > 0) {
                tree.settings.name = "Inschrijvingsgroepen"
                return GroupCategoryTree.create({
                    settings: GroupCategorySettings.create({
                        name: ""
                    }),
                    categories: [tree]
                })
            }

            return tree
        }

        // Broken setup here
        console.warn("Root category ID is missing in categories. Migration might be needed")
        return GroupCategoryTree.create({ })
    }

    /**
     * @deprecated
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    getCategoryTreeWithDepth(maxDepth: number): GroupCategoryTree {
        return this.getCategoryTree({maxDepth})
    }

    isCategoryDeactivated(category: GroupCategoryTree) {
        if (this.meta.packages.useActivities) {
            return false
        }
        const cleanedTree = this.getCategoryTree({maxDepth: 1})
        if (cleanedTree.categories.find( c => c.id === category.id)) {
            return false
        }
        return true
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

    /**
     * Only available for patching. Also available with lazy loading OrganizationAdmins
     */
    @field({ decoder: new ArrayDecoder(User), optional: true, version: 60 })
    admins?: User[]

    get resolvedRegisterDomain() {
        if (this.registerDomain) {
            return this.registerDomain
        } 

        return this.uri+'.'+(STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration[""])
    }

    get registerUrl() {
        return "https://"+this.resolvedRegisterDomain
    }

    get dashboardDomain(): string {
        return STAMHOOFD.domains.dashboard
    }
}

export class OrganizationWithWebshop extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization

    @field({ decoder: Webshop })
    webshop: Webshop
}

export class GetWebshopFromDomainResult extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization

    /**
     * There is one specific webshop for the given domain.
     */
    @field({ decoder: Webshop, nullable: true })
    webshop: Webshop | null = null

    /**
     * Multiple webshops possible. Show a selection page.
     */
    @field({ decoder: new ArrayDecoder(WebshopPreview), version: 137 })
    webshops: WebshopPreview[] = []
}

export const OrganizationPatch = Organization.patchType()