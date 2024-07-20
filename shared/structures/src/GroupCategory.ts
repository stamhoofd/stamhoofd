import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Group } from './Group';
// Eslint wants to remove Permissions, but it is needed for types!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessRight, LoadedPermissions, PermissionRole, PermissionsByRole, PermissionsResourceType } from './Permissions';
import { OrganizationRegistrationPeriod } from './RegistrationPeriod';
/**
 * Give access to a given resouce based by the roles of a user
 */
export class GroupCategoryPermissions extends AutoEncoder {
    /**
     * @deprecated
     * Can create new groups in this category or subcategories
     */
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    create: PermissionRole[] = []

    /**
     * @deprecated
     * Permissions automatically for all groups in this category
     */
    @field({decoder: PermissionsByRole, version: 203, optional: true})
    groupPermissions = PermissionsByRole.create({})
}

export class GroupCategorySettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    /**
     * Small text below the category title
     */
    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: BooleanDecoder })
    public = true

    @field({ decoder: IntegerDecoder, nullable: true, version: 59 })
    maximumRegistrations: number | null = null

    /**
     * @deprecated
     */
    @field({ decoder: GroupCategoryPermissions, version: 61 })
    permissions = GroupCategoryPermissions.create({})
}

export class GroupCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: GroupCategorySettings })
    settings = GroupCategorySettings.create({})

    /**
     * We only save the ID of groups because these are stored separately. To prevent that a group will be deleted when we simply move the group to a different category
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    groupIds: string[] = []

    /** 
     * Child category IDS
     * We use ID's to allow more flexible changes in the future
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    categoryIds: string[] = []

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[]): GroupCategory[] {
        const map = new Map<string, GroupCategory>()

        // Avoid recursive loop: can never call getParentCategories on itself again
        const filteredAll = all.filter(g => g.id !== this.id)
        
        const parents = filteredAll.filter(g => g.categoryIds.includes(this.id))
        for (const parent of parents) {
            map.set(parent.id, parent)

            const hisParents = parent.getParentCategories(filteredAll)
            for (const pp of hisParents) {
                 map.set(pp.id, pp)
            }
        }

        return [...map.values()]
    }

    isPublic(allCategories: GroupCategory[]): boolean {
        if (!this.settings.public) {
            return false;
        }
        for (const parent of this.getParentCategories(allCategories)) {
            if (!parent.settings.public) {
                return false
            }
        }
        return true;
    }

    canEdit(permissions: LoadedPermissions|null): boolean {
        if (permissions?.hasFullAccess()) {
            return true
        }
        return false
    }

    canCreate(permissions: LoadedPermissions|null, categories: GroupCategory[] = []): boolean {
        if (!permissions) {
            return false
        }

        if (permissions.hasResourceAccessRight(PermissionsResourceType.GroupCategories, this.id, AccessRight.OrganizationCreateGroups)) {
            return true;
        }
        
        const parents = this.getParentCategories(categories)
        for (const parent of parents) {
            if (permissions.hasResourceAccessRight(PermissionsResourceType.GroupCategories, parent.id, AccessRight.OrganizationCreateGroups)) {
                return true
            }
        }
        return false
    }
}

export class GroupCategoryTree extends GroupCategory {
    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = []

    @field({ decoder: new ArrayDecoder(GroupCategoryTree) })
    categories: GroupCategoryTree[] = []

    get depth(): number {
        if (this.groups.length > 0) {
            return 0
        }
        if (this.categories.length == 0) {
            return 0
        }

        return Math.max(...this.categories.map(c => c.depth)) + 1
    }

    getAllGroups(): Group[] {
        return [...this.groups, ...this.categories.flatMap(c => c.getAllGroups())]
    }

    getAllCategories(): GroupCategoryTree[] {
        return [...this.categories, ...this.categories.flatMap(c => c.getAllCategories())]
    }

    getMemberCount({cycleOffset, waitingList}: {cycleOffset?: number, waitingList?: boolean} = {}) {
        if (this.getAllGroups().length == 0) {
            return null
        }

        let count = 0
        for (const group of this.getAllGroups()) {
            const c = group.getMemberCount({cycleOffset, waitingList});
            if (c === null) {
                if (cycleOffset && group.cycle < cycleOffset) {
                    // This group did not have active registrations at the time
                    continue
                }
                return null
            }
            count += c
        }
        return count
    }

    static build(root: GroupCategory, organizationPeriod: OrganizationRegistrationPeriod, options: {permissions?: LoadedPermissions | null, maxDepth?: number | null, smartCombine?: boolean, groups?: Group[]} = {}): GroupCategoryTree {
        const categories = organizationPeriod.settings.categories
        const groups = options?.groups ?? organizationPeriod.groups

        const permissions = options.permissions ?? null
        const maxDepth = options.maxDepth ?? null
        const smartCombine = options.smartCombine ?? false

        return GroupCategoryTree.create({ 
            ...root,
            categories: root.categoryIds.flatMap(id => {
                const f = categories.find(c => c.id === id)
                if (f) {
                    const t = GroupCategoryTree.build(f, organizationPeriod, {
                        ...options,
                        maxDepth: maxDepth !== null ? maxDepth - 1 : null
                    })

                    if (t.categories.length == 0 && t.groups.length == 0 && (smartCombine || (permissions !== null && !permissions.hasResourceAccessRight(PermissionsResourceType.GroupCategories, t.id, AccessRight.OrganizationCreateGroups)))) {
                        // Hide empty categories where we cannot create new groups or when smart combine is enabled
                        return []
                    }

                    // if (smartCombine && !t.categories.find(c => c.categories.length || c.groups.length > 1)) {
                    //     // If all categories only have groups and no more than 1 group, combine them all
                    //     t.groups = t.getAllGroups()
                    //     t.categories = []
                    // }
                    
                    if (maxDepth !== null && t.depth >= maxDepth && t.categories.length > 0) {
                        const categories: GroupCategoryTree[] = []
                        for (const cat of t.categories) {
                            if (smartCombine && cat.groups.length === 0 && cat.categories.length === 0) {
                                continue
                            }
                            // Clone reference
                            cat.settings = GroupCategorySettings.create(cat.settings)
                            cat.settings.name = t.settings.name + " - " + cat.settings.name
                            cat.settings.public = t.settings.public && cat.settings.public
                            categories.push(cat)
                        }
                        // Concat here
                        return categories
                    }
                    return [t]
                }
                return []
            }),
            groups: root.groupIds.flatMap(id => {
                const g = groups.find(c => c.id === id)
                if (g) {
                    // Hide groups we don't have permissions for
                    if (permissions && (!g.hasReadAccess(permissions, categories))) {
                        return []
                    }
                    return [g]
                }
                return []
            })
        })
    }

    /**
     * Filter groups
     */
    filter(keep: (group: Group) => boolean): GroupCategoryTree {
        const categories = this.categories.flatMap((category) => {
            const filtered = category.filter(keep)
            if (filtered.groups.length == 0 && filtered.categories.length == 0) {
                return []
            }
            return [filtered]
        })

        const groups = this.groups.filter(keep)
        return GroupCategoryTree.create(
            Object.assign({}, this, {
                categories,
                groups
            })
        )
    }

    /**
     * Remove empty categories and non-public categories
     * @param admin Whether not-public categories should be visible
     */
    filterForDisplay(admin = false, useActivities = true, smartCombine = false): GroupCategoryTree {
        const categories = this.categories.flatMap((category) => {
            if (!admin && !category.settings.public) {
                return []
            }
            const filtered = category.filterForDisplay(admin, useActivities)
            if (smartCombine && filtered.groups.length == 0 && filtered.categories.length == 0) {
                return []
            }
            return [filtered]
        })
        

        return GroupCategoryTree.create(
            Object.assign({}, this, {
                categories: (useActivities || categories.length == 0) ? categories : [categories[0]]
            })
        )
    }
}
