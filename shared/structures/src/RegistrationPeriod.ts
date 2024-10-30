import { ArrayDecoder, AutoEncoder, BooleanDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Group, GroupStatus } from './Group.js';
import { GroupCategory, GroupCategorySettings, GroupCategoryTree } from './GroupCategory.js';
import { Organization } from './Organization.js';
import { RegistrationPeriodBase } from './RegistrationPeriodBase.js';
import { SetupSteps } from './SetupSteps.js';

export class RegistrationPeriodSettings extends AutoEncoder {
    // todo
}

export class RegistrationPeriod extends RegistrationPeriodBase {
    @field({ decoder: RegistrationPeriodSettings })
    settings = RegistrationPeriodSettings.create({});
}

export class OrganizationRegistrationPeriodSettings extends AutoEncoder {
    /**
     * All the available categories
     */
    @field({ decoder: new ArrayDecoder(GroupCategory) })
    categories: GroupCategory[] = [GroupCategory.create({ id: 'root' })]; // we use ID root here because this ID needs to stay the same since it won't be saved

    /**
     * We use one invisible root category to simplify the difference between non-root and root category
     */
    @field({ decoder: StringDecoder })
    rootCategoryId = this.categories[0]?.id ?? '';

    get rootCategory(): GroupCategory | undefined {
        return this.categories.find(c => c.id === this.rootCategoryId);
    }
}

export class OrganizationRegistrationPeriod extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: RegistrationPeriod })
    period: RegistrationPeriod;

    @field({ decoder: OrganizationRegistrationPeriodSettings })
    settings = OrganizationRegistrationPeriodSettings.create({});

    @field({ decoder: new ArrayDecoder(Group) })
    groups: Group[] = [];

    @field({ decoder: SetupSteps, version: 324 })
    setupSteps = SetupSteps.create({});

    /**
     * Get all groups that are in a category
     */
    get availableCategories() {
        return this.adminCategoryTree.getAllCategories();
    }

    /**
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    get categoryTree(): GroupCategoryTree {
        return this.getCategoryTree();
    }

    get publicCategoryTree(): GroupCategoryTree {
        return this.getCategoryTree({ smartCombine: true });
    }

    get adminCategoryTree(): GroupCategoryTree {
        return this.getCategoryTree({ admin: true });
    }

    get waitingLists(): Group[] {
        return (this.groups.map(g => g.waitingList).filter(g => g !== null)).filter((value, index, self) => self.findIndex(v => value.id === v.id) === index);
    }

    get rootCategory() {
        return this.settings.categories.find(c => c.id === this.settings.rootCategoryId);
    }

    /**
     * Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     *
     * For registration members perspective, try to use options.admin instead of options.permissions.
     * options.permissions is only used if you want to hide groups and empty categories that you don't have permissions for.
     */
    getCategoryTree(options?: {
        organization?: Organization;
        maxDepth?: number;
        filterGroups?: (group: Group) => boolean;
        permissions?: import('./LoadedPermissions.js').LoadedPermissions | null;
        smartCombine?: boolean;
        admin?: boolean;
    }): GroupCategoryTree {
        const root = this.rootCategory;
        if (root) {
            let tree = GroupCategoryTree.build(root, this, {
                groups: options?.filterGroups ? this.groups.filter(options.filterGroups) : undefined,
                permissions: options?.permissions,
                maxDepth: options?.maxDepth,
                smartCombine: options?.smartCombine,
            });

            if (!options?.permissions) {
                // Hide non public items
                tree = tree.filterForDisplay(options?.admin ?? false, (options?.organization?.meta.packages.useActivities ?? true) || options?.admin, options?.smartCombine);
            }

            if (tree.categories.length == 0 && tree.groups.length > 0) {
                tree.settings.name = 'Inschrijvingsgroepen';
                return GroupCategoryTree.create({
                    settings: GroupCategorySettings.create({
                        name: '',
                    }),
                    categories: [tree],
                });
            }

            const usedGroups = tree.getAllGroups();
            const unusedGroups = this.groups.filter(g => !usedGroups.includes(g));
            if (unusedGroups.length > 0) {
                console.warn('Unused groups found in category tree');
            }

            return tree;
        }

        // Broken setup here
        console.warn('Root category ID is missing in categories. Migration might be needed');
        return GroupCategoryTree.create({ });
    }

    isCategoryDeactivated(organization: Organization, category: GroupCategoryTree) {
        if (organization.meta.packages.useActivities) {
            return false;
        }
        const cleanedTree = this.getCategoryTree({ maxDepth: 1 });
        if (cleanedTree.categories.find(c => c.id === category.id)) {
            return false;
        }
        return true;
    }

    duplicate(newPeriod: RegistrationPeriod) {
        // Create new groups + map old to new groups
        const groupMap = new Map<string, string>();
        const categoryMap = new Map<string, string>();

        const newOrganizationPeriod = OrganizationRegistrationPeriod.create({
            period: newPeriod,
        });

        const yearDifference = newPeriod.startDate.getFullYear() - this.period.startDate.getFullYear();

        for (const group of this.groups) {
            const newGroup = Group.create({
                ...group,
                id: undefined,
                periodId: newPeriod.id,
                settings: group.settings.clone(),
            });

            // Increase all dates with exactly one year

            if (newGroup.settings.registrationStartDate) {
                newGroup.settings.registrationStartDate.setFullYear(newGroup.settings.registrationStartDate.getFullYear() + yearDifference);
            }

            if (newGroup.settings.registrationEndDate) {
                newGroup.settings.registrationEndDate.setFullYear(newGroup.settings.registrationEndDate.getFullYear() + yearDifference);
            }

            // Force close
            newGroup.status = GroupStatus.Closed;

            groupMap.set(group.id, newGroup.id);
            newOrganizationPeriod.groups.push(newGroup);
        }

        for (const category of this.settings.categories) {
            const newCategory = category.clone();
            newCategory.id = uuidv4();
            newCategory.groupIds = category.groupIds.map(groupId => groupMap.get(groupId)!).filter(id => id);

            categoryMap.set(category.id, newCategory.id);
            newOrganizationPeriod.settings.categories.push(newCategory);
        }

        // Update category ids
        for (const category of newOrganizationPeriod.settings.categories) {
            category.categoryIds = category.categoryIds.map(categoryId => categoryMap.get(categoryId)!).filter(id => id);
        }

        // Update root category id
        newOrganizationPeriod.settings.rootCategoryId = categoryMap.get(this.settings.rootCategoryId)!;
        return newOrganizationPeriod;
    }
}

export class RegistrationPeriodList extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(OrganizationRegistrationPeriod) })
    organizationPeriods: OrganizationRegistrationPeriod[] = [];

    @field({ decoder: new ArrayDecoder(RegistrationPeriod) })
    periods: RegistrationPeriod[] = [];
}
