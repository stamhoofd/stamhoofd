import { Migration } from '@simonbackx/simple-database';
import { Group, Organization } from '@stamhoofd/models';
import type { RecordCategory, StamhoofdFilter } from '@stamhoofd/structures';
import { PropertyFilter } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

type GroupStamhoofdFilter = { group: { id: { $eq: string } } };

class GroupStamhoofdFilterUpdateHelper {
    private readonly filter: GroupStamhoofdFilter;
    private readonly removePropertyFilter: () => void;
    private readonly setPropertyFilterOnGroup: (group: Group) => void;

    constructor({ filter, removePropertyFilter, setPropertyFilterOnGroup }: { filter: GroupStamhoofdFilter; removePropertyFilter: () => void; setPropertyFilterOnGroup: (group: Group) => void }) {
        this.filter = filter;
        this.removePropertyFilter = removePropertyFilter;
        this.setPropertyFilterOnGroup = setPropertyFilterOnGroup;
    }

    get groupId() {
        return this.filter.group.id.$eq;
    }

    async getGroup() {
        return await Group.getByID(this.groupId);
    }

    // todo: remove propertyFilter
    async update() {
        // todo: remove property filter
        const group = await this.getGroup();

        // todo: support old groups with cycle?
        if (group) {
            this.removePropertyFilter();
            this.setPropertyFilterOnGroup(group);
        } else {
            // todo: disable?
        }
        // todo: move property filter to group
    }
}

/**
 * Needed:
 * groupId
 * remove property Filter
 * stamhoofd filter without group filter
 */

class GroupStamhoofdFilterUpdateHelper2 {
    private readonly groupId: string;
    private readonly removePropertyFilter: () => void;
    private readonly setPropertyFilterOnGroup: (group: Group) => void;

    constructor({ groupId, removePropertyFilter, setPropertyFilterOnGroup }:
    { groupId: string; removePropertyFilter: () => void; setPropertyFilterOnGroup: (group: Group) => void }) {
        this.groupId = groupId;
        this.removePropertyFilter = removePropertyFilter;
        this.setPropertyFilterOnGroup = setPropertyFilterOnGroup;
    }

    async getGroup() {
        return await Group.getByID(this.groupId);
    }

    // todo: remove propertyFilter
    async update() {
        // todo: remove property filter
        const group = await this.getGroup();

        // todo: support old groups with cycle?
        if (group) {
            this.removePropertyFilter();
            this.setPropertyFilterOnGroup(group);
        } else {
            // todo: disable?
        }
        // todo: move property filter to group
    }
}

export async function startMigration() {
    // todo: loop all record configurations where a groupId is configured
    // should only be the case for organization record configurations

    await SeedTools.loop({
        batchSize: 100,
        query: Organization.select(),
        action: async (organization: Organization) => {
            const allGroupFilters: GroupStamhoofdFilterUpdateHelper[] = [];
            for (const filter of getAllStamhoofdFilters(organization)) {
                const groupFilters = findGroupFilters(filter);
                allGroupFilters.push(...groupFilters);
            }

            if (allGroupFilters.length === 0) {
                return;
            }

            const groupIds = new Set(allGroupFilters.map(filter => filter.group.id.$eq));
            const groups = await Group.getByIDs(...groupIds);
            const groupMap = new Map(groups.map(g => [g.id, g]));

            for (const filter of allGroupFilters) {
                const group = groupMap.get(filter.group.id.$eq);
                if (!group) {
                    console.error('Could not find group with id', filter.group.id.$eq);
                }

                // todo: update filter
            }
        },
    });
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startMigration();
    throw new Error('test');
});

function getAllStamhoofdFilters(organization: Organization): StamhoofdFilter[] {
    return getAllPropertyFilters(organization)
        .flatMap(propertyFilter => [propertyFilter.enabledWhen, propertyFilter.requiredWhen].filter(filter => filter !== null) as StamhoofdFilter[]);
}

function getAllPropertyFilters(organization: Organization) {
    const recordsConfig = organization.meta.recordsConfiguration;

    const propertyFilters: PropertyFilter[] = [];

    for (const [key, value] of Object.entries(recordsConfig)) {
        if (value instanceof PropertyFilter) {
            propertyFilters.push(value);
        }
    }

    // todo: also add record categories
    const recordCategoryFilters: PropertyFilter[] = recordsConfig.recordCategories.flatMap(category => getAllRecordCategories(category)).map(c => c.filter).filter(f => f !== null);

    return [...propertyFilters, ...recordCategoryFilters];
}

function getAllRecordCategories(recordCategory: RecordCategory): RecordCategory[] {
    const childCategories = recordCategory.childCategories.flatMap(c => getAllRecordCategories(c));
    return [recordCategory, ...childCategories];
}

function findGroupFilters(filter: StamhoofdFilter): GroupStamhoofdFilterUpdateHelper[] {
    if (filter === null) {
        return [];
    }

    if (typeof filter !== 'object') {
        return [];
    }

    if (filter instanceof Date) {
        return [];
    }

    if (Array.isArray(filter)) {
        return filter.flatMap(f => findGroupFilters(f) ?? []);
    }

    const results: GroupStamhoofdFilterUpdateHelper[] = [];

    // iterate properties
    for (const [key, value] of Object.entries(filter as object)) {
        if (key === 'group') {
            const possibleMatch: { id?: { $eq?: string | any } | any } | any = value;
            if (typeof possibleMatch?.id?.$eq === 'string') {
                const groupFilter = possibleMatch as GroupStamhoofdFilter;
                const result = new GroupStamhoofdFilterUpdateHelper({
                    filter: groupFilter,
                    removePropertyFilter: () => {

                    },
                    setPropertyFilterOnGroup: () => {

                    },
                });
                results.push(result);
                continue;
            }
        }

        results.push(...findGroupFilters(value));
    }

    return results;
}

// function findGroupFiltersHelper<T extends Record<string, StamhoofdFilter>>(filter: T): T[] | null {
//     // if(filter === null) {
//     //     return null;
//     // }

//     // if(typeof filter !== 'object') {
//     //     return null;
//     // }

//     // if(Array.isArray(filter)) {
//     //     return filter.flatMap(f => findGroupFilters(f) ?? []);
//     // }

//     // return null;
// }
