import { Migration } from '@simonbackx/simple-database';
import { Group, Organization } from '@stamhoofd/models';
import type { RecordCategory, StamhoofdCompareValue, StamhoofdFilter, StamhoofdMagicRelationFilter } from '@stamhoofd/structures';
import { GroupType } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export async function startMigration(dryRun = false) {
    await SeedTools.loop({
        batchSize: 100,
        query: Organization.select(),
        action: async (organization: Organization) => {
            await fixUnreadableGroupFilters(organization, dryRun);
        },
    });

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
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

    const dryRun = false;
    await startMigration(dryRun);
});

function getAllRecordCategories(organization: Organization): RecordCategory[] {
    function getAllRecordCategoiesRecursive(category: RecordCategory) {
        const results: RecordCategory[] = [category];

        for (const child of category.childCategories) {
            results.push(...getAllRecordCategoiesRecursive(child));
        }
        return results;
    }

    return organization.meta.recordsConfiguration.recordCategories.flatMap(c => getAllRecordCategoiesRecursive(c));
}

async function fixUnreadableGroupFilters(organization: Organization, dryRun: boolean) {
    const filtersWithGroupFilters: StamhoofdFilter[] = getAllRecordCategories(organization).flatMap((c) => {
        const filter = c.filter;
        if (filter === null) {
            return [];
        }

        return [filter.enabledWhen, filter.requiredWhen].filter((f) => {
            return hasRegistrationsFilter(f);
        });
    });

    if (filtersWithGroupFilters.length === 0) {
        return;
    }

    console.log('organization:', organization.name);

    for (const filter of filtersWithGroupFilters) {
        const groupIds = getGroupIdsFromFilter(filter);
        if (groupIds.length === 0) {
            continue;
        }

        const groups = await Group.getByIDs(...new Set(groupIds));
        const groupMap = new Map(groups.map(g => [g.id, g]));

        console.log('groupIds:', groupIds);

        console.error('filter before: ', JSON.stringify(filter));

        await makeGroupFiltersReadable(filter, groupMap);

        console.error('filter after: ', JSON.stringify(filter));
    }

    if (!dryRun) {
        await organization.save();
    }
}

class StamhoofdFilterHelper {
    static isRecordOrArray(value: StamhoofdFilter): value is { [key: string]: StamhoofdFilter } | StamhoofdFilter[] {
        if (typeof value !== 'object' || value === null || value instanceof Date) {
            return false;
        }

        return true;
    }

    static isRecord(value: StamhoofdFilter): value is { [key: string]: StamhoofdFilter } {
        if (!this.isRecordOrArray(value) || Array.isArray(value)) {
            return false;
        }

        return true;
    }

    static isRecordWithSingleEntry(value: StamhoofdFilter): value is { [key: string]: StamhoofdFilter } {
        if (!this.isRecord(value)) {
            return false;
        }

        return Object.entries(value).length === 1;
    }

    static isEmptyRecord(value: StamhoofdFilter): value is { [key: string]: never } {
        if (!this.isRecord(value)) {
            return false;
        }

        return Object.entries(value).length === 0;
    }

    static hasRegistrationsFilter(filter: StamhoofdFilter): boolean {
        if (filter === null) {
            return false;
        }

        if (typeof filter !== 'object') {
            return false;
        }

        if (filter instanceof Date) {
            return false;
        }

        if (Array.isArray(filter)) {
            return filter.some(f => this.hasRegistrationsFilter(f));
        }

        if (this.isRegistrationFilter(filter)) {
            return true;
        }

        // iterate properties
        for (const [, value] of Object.entries(filter as object) as [string, StamhoofdFilter | StamhoofdCompareValue][]) {
            if (this.hasRegistrationsFilter(value)) {
                return true;
            }
        }

        return false;
    }

    static isRegistrationFilter(filter: StamhoofdFilter): filter is { registrations: StamhoofdFilter } & StamhoofdFilter {
        if (!StamhoofdFilterHelper.isRecord(filter)) {
            return false;
        }

        return Object.entries(filter).some(entry => entry[0] === 'registrations');
    }
}

function hasRegistrationsFilter(filter: StamhoofdFilter): boolean {
    if (filter === null) {
        return false;
    }

    if (typeof filter !== 'object') {
        return false;
    }

    if (filter instanceof Date) {
        return false;
    }

    if (Array.isArray(filter)) {
        return filter.some(f => hasRegistrationsFilter(f));
    }

    if (isRegistrationFilter(filter)) {
        return true;
    }

    // iterate properties
    for (const [, value] of Object.entries(filter as object) as [string, StamhoofdFilter | StamhoofdCompareValue][]) {
        if (hasRegistrationsFilter(value)) {
            return true;
        }
    }

    return false;
}

function isRegistrationFilter(filter: StamhoofdFilter): filter is { registrations: StamhoofdFilter } & StamhoofdFilter {
    if (!StamhoofdFilterHelper.isRecord(filter)) {
        return false;
    }

    return Object.entries(filter).some(entry => entry[0] === 'registrations');
}

function getGroupIdsFromRegistrationsFilter(registrationFilter: { registrations: StamhoofdFilter }): string[] {
    if (!StamhoofdFilterHelper.isRecordWithSingleEntry(registrationFilter)) {
        throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
    }

    const entries = Object.entries(registrationFilter);

    let currentEntry = entries[0];

    while (true) {
        const currentKey = currentEntry[0];

        switch (currentKey) {
            case 'registrations':
            case '$elemMatch':
            case '$or':
            case '$and':
            case '$not':
            {
                break;
            }
            default: throw new Error(`Invalid registration filter (currentKey: ${currentKey}): ` + JSON.stringify(registrationFilter));
        }

        const currentValue = currentEntry[1];

        if (StamhoofdFilterHelper.isRecordWithSingleEntry(currentValue)) {
            currentEntry = Object.entries(currentValue)[0];
        } else if (Array.isArray(currentValue)) {
            return currentValue.map(item => getGroupIdsFromGroupFilters(item));
        } else {
            throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
        }
    }
}

function getGroupIdsFromGroupFilters(filter: StamhoofdFilter) {
    const groupId = (filter as { group?: { id?: { $eq?: string } } })?.group?.id?.$eq;
    if (typeof groupId !== 'string') {
        throw new Error('Invalid group filter: ' + JSON.stringify(filter));
    }
    return groupId;
}

function getGroupIdsFromFilter(filter: StamhoofdFilter): string[] {
    if (!StamhoofdFilterHelper.isRecordOrArray(filter)) {
        throw new Error('Invalid filter: ' + JSON.stringify(filter));
    }

    if (Array.isArray(filter)) {
        return filter.flatMap(item => getGroupIdsFromFilter(item));
    }

    const all: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
        if (key === 'registrations') {
            all.push(...getGroupIdsFromRegistrationsFilter({ [key]: value }));
            continue;
        }
        if (!StamhoofdFilterHelper.isRecordOrArray(value)) {
            continue;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                continue;
            }

            const isSomeRecordOrArray = value.some(item => StamhoofdFilterHelper.isRecordOrArray(item));

            if (!isSomeRecordOrArray) {
                continue;
            }

            for (const item of value) {
                // ignore null
                if (item === null) {
                    continue;
                }

                const isRecordOrArray = StamhoofdFilterHelper.isRecordOrArray(item);
                if (!isRecordOrArray) {
                    throw new Error('Invalid filter: ' + JSON.stringify(filter));
                }

                all.push(...getGroupIdsFromFilter(item));
            }
            continue;
        }

        all.push(...getGroupIdsFromFilter(value));
    }

    return all;
}

async function makeGroupFiltersReadable(filter: StamhoofdFilter, groupMap: Map<string, Group>): Promise<void> {
    async function getRelationFilter(filter: StamhoofdFilter, groupMap: Map<string, Group>): Promise<StamhoofdMagicRelationFilter> {
        const groupId = (filter as { group?: { id?: { $eq?: string } } })?.group?.id?.$eq;
        if (typeof groupId !== 'string') {
            throw new Error('Invalid group filter: ' + JSON.stringify(filter));
        }

        const group = groupMap.get(groupId);
        if (!group) {
            // double check if group exists, if not: set custom name
            const existingGroup = await Group.getByID(groupId);
            if (existingGroup) {
                // should never happen
                throw new Error(`Group with id ${groupId} exists but is not included in the groupMap`);
            }
        }

        const relationFilter: StamhoofdMagicRelationFilter = {
            $: '$rel',
            value: groupId,
            type: GroupType.Membership,
            name: group ? group.settings.name.toString() : 'Verwijderde groep',
        };

        return relationFilter;
    }

    async function makeRegistrationFilterReadable(registrationFilter: { registrations: StamhoofdFilter }): Promise<void> {
        if (!StamhoofdFilterHelper.isRecordWithSingleEntry(registrationFilter)) {
            throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
        }

        const entries = Object.entries(registrationFilter);

        let parentFilter: StamhoofdFilter | null = null;
        let currentEntry = entries[0];
        const relationFilterArray: StamhoofdMagicRelationFilter[] = [];
        let orParentFilter: StamhoofdFilter | null = null;

        while (true) {
            const currentKey = currentEntry[0];

            switch (currentKey) {
                case '$not':
                case '$and': {
                    throw new Error(`${currentKey} not supported`);
                }
                case 'registrations':
                case '$elemMatch':
                {
                    break;
                }
                case '$or': {
                    if (!parentFilter) {
                        throw new Error('Not expected parentFilter to be null: ' + JSON.stringify(registrationFilter));
                    }
                    orParentFilter = parentFilter;
                    break;
                }
                default: throw new Error(`Invalid registration filter (currentKey: ${currentKey}): ` + JSON.stringify(registrationFilter));
            }

            const currentValue = currentEntry[1];

            if (StamhoofdFilterHelper.isRecordWithSingleEntry(currentValue)) {
                parentFilter = currentEntry[1];
                currentEntry = Object.entries(currentValue)[0];
            } else if (Array.isArray(currentValue)) {
                if (orParentFilter === null) {
                    throw new Error('Not expected orParentFilter to be null');
                }
                for (const item of currentValue) {
                    const relationFilter = await getRelationFilter(item, groupMap);
                    relationFilterArray.push(relationFilter);
                }
                delete orParentFilter[currentKey];
                (orParentFilter as any)['groupId'] = {
                    $in: relationFilterArray,
                };
                return;
            } else {
                throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
            }
        }
    }

    if (!StamhoofdFilterHelper.isRecordOrArray(filter)) {
        throw new Error('Invalid filter: ' + JSON.stringify(filter));
    }

    if (Array.isArray(filter)) {
        for (const item of filter) {
            await makeGroupFiltersReadable(item, groupMap);
        }
        return;
    }

    for (const [key, value] of Object.entries(filter)) {
        if (key === 'registrations') {
            await makeRegistrationFilterReadable({ [key]: value });
            continue;
        }
        if (!StamhoofdFilterHelper.isRecordOrArray(value)) {
            continue;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                continue;
            }

            const isSomeRecordOrArray = value.some(item => StamhoofdFilterHelper.isRecordOrArray(item));

            if (!isSomeRecordOrArray) {
                continue;
            }

            for (const item of value) {
                // ignore null
                if (item === null) {
                    continue;
                }

                const isRecordOrArray = StamhoofdFilterHelper.isRecordOrArray(item);
                if (!isRecordOrArray) {
                    throw new Error('Invalid filter: ' + JSON.stringify(filter));
                }

                await makeGroupFiltersReadable(item, groupMap);
            }
            continue;
        }

        await makeGroupFiltersReadable(value, groupMap);
    }
}
