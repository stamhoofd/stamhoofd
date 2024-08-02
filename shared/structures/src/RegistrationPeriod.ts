import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { GroupCategory, GroupCategorySettings, GroupCategoryTree } from "./GroupCategory";
import { Formatter } from "@stamhoofd/utility";
import { Group } from "./Group";
import { LoadedPermissions } from "./Permissions";
import { Organization } from "./Organization";

export class RegistrationPeriodSettings extends AutoEncoder {
    // todo
}

export class RegistrationPeriod extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    @field({ decoder: BooleanDecoder })
    locked = false

    @field({ decoder: RegistrationPeriodSettings })
    settings = RegistrationPeriodSettings.create({})

    get name() {
        return 'Werkjaar ' + Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }

    get nameShort() {
        return Formatter.year(this.startDate) + ' - ' + Formatter.year(this.endDate);
    }
}

export class OrganizationRegistrationPeriodSettings extends AutoEncoder {
    /**
     * All the available categories
     */
    @field({ decoder: new ArrayDecoder(GroupCategory) })
    categories: GroupCategory[] = [GroupCategory.create({ id: "root" })] // we use ID root here because this ID needs to stay the same since it won't be saved

    /**
     * We use one invisible root category to simplify the difference between non-root and root category
     */
    @field({ decoder: StringDecoder })
    rootCategoryId = this.categories[0]?.id ?? ""

    get rootCategory(): GroupCategory | undefined {
        return this.categories.find(c => c.id === this.rootCategoryId)
    }
}

export class OrganizationRegistrationPeriod extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: RegistrationPeriod })
    period: RegistrationPeriod

    @field({ decoder: OrganizationRegistrationPeriodSettings })
    settings = OrganizationRegistrationPeriodSettings.create({})

    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = []

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

    get waitingLists(): Group[] {
        return (this.groups.map(g => g.waitingList).filter(g => g != null)  as Group[]).filter((value, index, self) => self.findIndex((v) => value.id === v.id) === index)
    }
    
    /**
     * Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     * 
     * For registration members perspective, try to use options.admin instead of options.permissions. 
     * options.permissions is only used if you want to hide groups and empty categories that you don't have permissions for.
     */
    getCategoryTree(options?: {
        organization?: Organization,
        maxDepth?: number, 
        filterGroups?: (group: Group) => boolean, 
        permissions?: LoadedPermissions | null, 
        smartCombine?: boolean,
        admin?: boolean
    }): GroupCategoryTree {
        const root = this.settings.categories.find(c => c.id === this.settings.rootCategoryId)
        if (root) {
            let tree = GroupCategoryTree.build(root, this, {
                groups: options?.filterGroups ? this.groups.filter(options.filterGroups) : undefined,
                permissions: options?.permissions, 
                maxDepth: options?.maxDepth, 
                smartCombine: options?.smartCombine
            })

            if (!options?.permissions) {
                // Hide non public items
                tree = tree.filterForDisplay(options?.admin ?? false, (options?.organization?.meta.packages.useActivities ?? true) || options?.admin, options?.smartCombine)
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

            const usedGroups = tree.getAllGroups()
            const unusedGroups = this.groups.filter(g => !usedGroups.includes(g))
            if (unusedGroups.length > 0) {
                console.warn("Unused groups found in category tree")
            }

            return tree
        }

        // Broken setup here
        console.warn("Root category ID is missing in categories. Migration might be needed")
        return GroupCategoryTree.create({ })
    }
}

export class RegistrationPeriodList extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(OrganizationRegistrationPeriod) })
    organizationPeriods: OrganizationRegistrationPeriod[] = []

    @field({ decoder: new ArrayDecoder(RegistrationPeriod) })
    periods: RegistrationPeriod[] = []
}

