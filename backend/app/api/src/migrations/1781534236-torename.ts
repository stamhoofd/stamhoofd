// check all propert filters of organization

import type { Group, Organization } from '@stamhoofd/models';
import type { OrganizationRecordsConfiguration, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { PropertyFilter } from '@stamhoofd/structures';

// if property filter has some stamhoofd filter with a group filter

// case 1: enabledWhen

// move the property filter to the group

// remove the property filter from the organization

// clean the stamhoofd filter (remove the group filter)

// case 2: requiredWhen

// move the property filter to the group

// leave the property filter in the organization

// clean the stamhoofd filter (both on group and organization)

// case 3: both enabledWhen and requiredWhen -> only check enabledWhen but also clean requiredWhen?

function start(organization: Organization) {

}

type GroupStamhoofdFilter = { group: { id: { $eq: string } } };

class StamhoofdFilterHelper {
    static isRecord(value: StamhoofdFilter): value is { [key: string]: StamhoofdFilter } {
        if (typeof value !== 'object' || value === null || value instanceof Date || Array.isArray(value)) {
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
}

class RegistrationsFilterWrapper {
    private isInverted: boolean;
    private mode: 'and' | 'or' = 'and';
    private groupdIds: Set<string>;
    private otherFilters: StamhoofdFilter[] = [];

    constructor(private readonly filter: StamhoofdFilter & { registrations: StamhoofdFilter }, isInverted: boolean) {
        this.isInverted = isInverted;
        this.readDataFromFilter(filter);
    }

    static isRegistrationFilter(filter: StamhoofdFilter): filter is { registrations: StamhoofdFilter } & StamhoofdFilter {
        if (!StamhoofdFilterHelper.isRecord(filter)) {
            return false;
        }

        return Object.entries(filter).some(entry => entry[0] === 'registrations');
    }

    private readDataFromFilter(filter: StamhoofdFilter & { registrations: StamhoofdFilter }) {
        const otherFilters: StamhoofdFilter[] = [];

        const registrationFilter = filter.registrations;

        this.readRegistrationFilter(registrationFilter);

        const otherEntries = Object.entries(filter).filter(entry => entry[0] !== 'registrations');

        for (const entry of otherEntries) {
            const filter = Object.fromEntries([entry]);
            otherFilters.push(filter);
        }

        this.otherFilters = otherFilters;
    }

    private readRegistrationFilter(registrationFilter: StamhoofdFilter): void {
        if (!StamhoofdFilterHelper.isRecordWithSingleEntry(registrationFilter)) {
            throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
        }

        const entries = Object.entries(registrationFilter);

        let currentEntry = entries[0];

        while (true) {
            const currentKey = currentEntry[0];

            switch (currentKey) {
                case '$not': {
                    if (this.isInverted === true) {
                        throw new Error('Double inversion, check filter: ' + JSON.stringify(this.filter));
                    }
                    this.isInverted = true;
                    break;
                }
                case '$elemMatch': {
                    break;
                }
                case '$or': {
                    this.mode = 'or';
                    break;
                }
                case '$and': {
                    this.mode = 'and';
                    break;
                }
                default: throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
            }

            const currentValue = currentEntry[1];

            if (StamhoofdFilterHelper.isRecordWithSingleEntry(currentValue)) {
                currentEntry = Object.entries(currentValue)[0];
            } else if (Array.isArray(currentValue)) {
                this.groupdIds = new Set(currentValue.map(item => this.getGroupIdsFromGroupFilters(item)));
                break;
            } else {
                throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
            }
        }
    }

    private getGroupIdsFromGroupFilters(filter: StamhoofdFilter) {
        const groupId = (filter as { group?: { id?: { $eq?: string } } })?.group?.id?.$eq;
        if (typeof groupId !== 'string') {
            throw new Error('Invalid group filter: ' + JSON.stringify(filter));
        }
        return groupId;
    }
}

class PropertyFilterWrapper {
    private readonly propertyFilter: PropertyFilter;
    private readonly setPropertyFilterOnOrganization: (propertyFilter: PropertyFilter | null) => void;
    private readonly setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => void;

    constructor({ propertyFilter, setPropertyFilterOnOrganization, setPropertyFilterOnGroup }: { propertyFilter: PropertyFilter;
        // to set or remove propertyFilter on the organization
        setPropertyFilterOnOrganization: (propertyFilter: PropertyFilter | null) => void;
        // to set the propertyFilter on the group
        setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => void;
    }) {
        this.propertyFilter = propertyFilter;
        this.setPropertyFilterOnOrganization = setPropertyFilterOnOrganization;
        this.setPropertyFilterOnGroup = setPropertyFilterOnGroup;
    }
}

// has group filter -> remove group filter -> set new StamhoofdFilter -> keep track of group to set config on

abstract class StamhoofdFilterWrapperBase {
    private readonly hasGroupFilter: boolean;

    constructor(filter: StamhoofdFilter) {

    }

    findGroupFilters(filter: StamhoofdFilter | StamhoofdCompareValue, mode: '$and' | '$or' | '$not'): GroupStamhoofdFilter[] {
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
            return filter.flatMap(f => this.findGroupFilters(f, mode) ?? []);
        }

        const results: GroupStamhoofdFilter[] = [];

        // iterate properties
        for (const [key, value] of Object.entries(filter as object) as [string, StamhoofdFilter | StamhoofdCompareValue][]) {
            if (key === '$and' || key === '$or' || key === '$not') {
                results.push(...this.findGroupFilters(value, key as '$and' | '$or' | '$not'));
                continue;
            }

            if (key === 'group') {
                const possibleMatch: { id?: { $eq?: string | any } | any } | any = value;
                if (typeof possibleMatch?.id?.$eq === 'string') {
                    const groupFilter = possibleMatch as GroupStamhoofdFilter;

                    // todo: check if and or or
                    // handle

                    results.push(groupFilter);
                    continue;
                }
            }

            results.push(...this.findGroupFilters(value, '$and'));
        }

        return results;
    }

    abstract handle(): void;

    /**
     * check if a group filter is present
     * and if so, handle it
     */
    handleGroupFilter() {

    }
}

class StamhoofdFilterWrapper {
    constructor({ filter, updateFilter }: { filter: StamhoofdFilter; updateFilter: (filter: StamhoofdFilter) => void }) {

    }
}

function getAllPropertyFilters(organization: Organization): GroupStamhoofdFilterUpdateHelper2[] {
    const recordsConfig: OrganizationRecordsConfiguration = organization.meta.recordsConfiguration;

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
