import { ArrayDecoder, AutoEncoder, BooleanDecoder, field,IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Group } from './Group';
import { PermissionRole } from './Permissions';

/**
 * Give access to a given resouce based by the roles of a user
 */
export class GroupCategoryPermissions extends AutoEncoder {
    /**
     * Can create new subgroups or categories in this category
     */
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    create: PermissionRole[] = []

    /// Permissions for groups, subcategories in this category
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    read: PermissionRole[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    write: PermissionRole[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    full: PermissionRole[] = []
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
}

export class GroupCategoryTree extends GroupCategory {
    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = []

    @field({ decoder: new ArrayDecoder(GroupCategoryTree) })
    categories: GroupCategoryTree[] = []

    static build(root: GroupCategory, categories: GroupCategory[], groups: Group[]): GroupCategoryTree {
        return GroupCategoryTree.create({ 
            ...root,
            categories: root.categoryIds.flatMap(id => {
                const f = categories.find(c => c.id === id)
                if (f) {
                    return [GroupCategoryTree.build(f, categories, groups)]
                }
                return []
            }),
            groups: root.groupIds.flatMap(id => {
                const g = groups.find(c => c.id === id)
                if (g) {
                    return [g]
                }
                return []
            })
        })
    }
}