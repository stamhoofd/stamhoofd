import { ArrayDecoder, AutoEncoder, BooleanDecoder, field,IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Group } from './Group';
// Eslint wants to remove Permissions, but it is needed for types!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PermissionLevel, PermissionRole, Permissions } from './Permissions';

/**
 * Give access to a given resouce based by the roles of a user
 */
export class GroupCategoryPermissions extends AutoEncoder {
    /**
     * Can create new groups in this category or subcategories
     */
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    create: PermissionRole[] = []

    /**
     * Whetever a given user has access to the members in this group. 
     */
    getPermissionLevel(permissions: Permissions): PermissionLevel.None | "Create" {
        if (permissions.hasFullAccess()) {
            return "Create"
        }

        for (const role of this.create) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return "Create"
            }
        }

        return PermissionLevel.None
    }
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

    /// Might move these to private settings, but is not an issue atm
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

    canEdit(permissions: Permissions): boolean {
        if (permissions.hasFullAccess()) {
            return true
        }
        return false
    }

    canCreate(permissions: Permissions, categories: GroupCategory[] = []): boolean {
        if (permissions.hasFullAccess()) {
            return true
        }
        for (const role of this.settings.permissions.create) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return true
            }
        }

        const parents = this.getParentCategories(categories)
        for (const parent of parents) {
            if (parent.canCreate(permissions, [])) {
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

    getAllGroups() {
        return [...this.groups, ...this.categories.flatMap(c => c.getAllGroups())]
    }

    /**
     * 
     * @param root 
     * @param categories 
     * @param groups 
     * @param permissions 
     * @param maxDepth Should be at least 1, we don't support building only groups
     */
    static build(root: GroupCategory, categories: GroupCategory[], groups: Group[], permissions: Permissions | null = null, maxDepth: number | null = null): GroupCategoryTree {
        return GroupCategoryTree.create({ 
            ...root,
            categories: root.categoryIds.flatMap(id => {
                const f = categories.find(c => c.id === id)
                if (f) {
                    const t = GroupCategoryTree.build(f, categories, groups, permissions)

                    if (permissions !== null && t.categories.length == 0 && t.groups.length == 0 && !f.canCreate(permissions, categories)) {
                        // Hide empty categories where we cannot create new groups
                        return []
                    }
                    
                    if (maxDepth !== null && t.depth >= maxDepth) {
                        for (const cat of t.categories) {
                            // Clone reference
                            cat.settings = GroupCategorySettings.create(cat.settings)
                            cat.settings.name = t.settings.name + " - " + cat.settings.name
                            cat.settings.public = t.settings.public && cat.settings.public
                        }
                        // Concat here
                        return t.categories
                    }
                    return [t]
                }
                return []
            }),
            groups: root.groupIds.flatMap(id => {
                const g = groups.find(c => c.id === id)
                if (g) {
                    // Hide groups we don't have permissions for
                    if (permissions && !g.canViewMembers(permissions)) {
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
    filterForDisplay(admin = false, useActivities = true): GroupCategoryTree {
        const categories = this.categories.flatMap((category) => {
            if (!admin && !category.settings.public) {
                return []
            }
            const filtered = category.filterForDisplay(admin, useActivities)
            if (filtered.groups.length == 0 && filtered.categories.length == 0) {
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