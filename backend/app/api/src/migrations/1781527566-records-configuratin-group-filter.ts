import { Migration } from '@simonbackx/simple-database';
import type { Group } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import type { OrganizationRecordsConfiguration, RecordCategory, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { PropertyFilter } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export async function startMigration() {
    await SeedTools.loop({
        batchSize: 100,
        query: Organization.select(),
        action: async (organization: Organization) => {
            const organizationHandler = new OrganizationHandler(organization);
            await organizationHandler.handle();
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

type GroupStamhoofdFilter = { group: { id: { $eq: string } } };

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
        for (const [key, value] of Object.entries(filter as object) as [string, StamhoofdFilter | StamhoofdCompareValue][]) {
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

    static splitOrFilterFromRoot(filter: StamhoofdFilter): StamhoofdFilter[] {
        if (!this.isRecord(filter)) {
            throw new Error('The root should be a record');
        }

        const entries = Object.entries(filter);
        if (entries.length > 1) {
            // in theory could be possible but this is not expected based on the data -> we do not support this
            throw new Error('The root unexepctedly has more than one entry');
        }

        const [key, value] = entries[0];
        if (key === '$or') {
            if (Array.isArray(value)) {
                return value;
            }

            if (!this.isRecord(value)) {
                throw new Error('The $or value is not a record');
            }

            return Object.entries(value).map(([key, value]) => {
                return {
                    [key]: value,
                };
            });
        }

        return [filter];
    }

    static throwIfHasOrFilter(filter: StamhoofdFilter, skipKeys: string[]): void {
        if (!this.isRecordOrArray(filter)) {
            return;
        }

        if (Array.isArray(filter)) {
            filter.forEach(f => this.throwIfHasOrFilter(f, skipKeys));
            return;
        }

        Object.entries(filter).forEach(([key, value]) => {
            if (key === '$or') {
                throw new Error('The $or filter is not supported');
            }
            if (skipKeys.includes(key)) {
                return;
            }

            this.throwIfHasOrFilter(value, skipKeys);
        });
    }
}

class RegistrationsFilterHandler {
    private isInverted: boolean = false;
    private groupdIds: Set<string> | null = null;
    private otherFilters: StamhoofdFilter[] | null = null;
    private didFindRegistrationsFilter = false;

    constructor(private readonly filter: StamhoofdFilter) {
        this.initFromFilter(filter);
    }

    private initFromFilter(filter: StamhoofdFilter) {
        this.otherFilters = this.readAndFlattenFilter(filter);

        if (this.groupdIds === null) {
            throw new Error('groupdIds is null');
        }

        if (this.otherFilters === null) {
            throw new Error('otherFilters is null');
        }

        if (this.didFindRegistrationsFilter === false) {
            throw new Error('didFindRegistrationsFilter is false');
        }
    }

    /**
     * Reads data from registration filter and return an array of other filters as a flat array
     * @param filter
     */
    private readAndFlattenFilter(filter: StamhoofdFilter): StamhoofdFilter[] {
        // filter should not contain any $or filters

        if (!StamhoofdFilterHelper.isRecordOrArray(filter)) {
            throw new Error('Invalid filter: ' + JSON.stringify(filter));
        }

        if (Array.isArray(filter)) {
            return filter.flatMap(item => this.readAndFlattenFilter(item));
        }

        const all: StamhoofdFilter[] = [];

        for (const [key, value] of Object.entries(filter)) {
            if (key === '$or') {
                throw new Error('The $or filter is not supported');
            }

            if (key === 'registrations') {
                this.readRegistrationFilter({ [key]: value });
                continue;
            }

            if (!StamhoofdFilterHelper.isRecordOrArray(value)) {
                all.push({ [key]: value });
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) {
                    continue;
                }

                const isSomeRecordOrArray = value.some(item => StamhoofdFilterHelper.isRecordOrArray(item));

                if (!isSomeRecordOrArray) {
                    all.push({ [key]: value });
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

                    all.push(...this.readAndFlattenFilter(item).map(filter => ({ [key]: filter })));
                }
                continue;
            }

            all.push(...this.readAndFlattenFilter(value).map(filter => ({ [key]: filter })));
        }

        return all;
    }

    private readRegistrationFilter(registrationFilter: { registrations: StamhoofdFilter }): void {
        if (this.didFindRegistrationsFilter) {
            throw new Error('Found more than one registrations filter');
        }

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
                    // or is default mode
                    break;
                }
                case '$and': {
                    throw new Error(`The $and filter is not supported, check filter: ${JSON.stringify(this.filter)}`);
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

class PropertyFilterHandler {
    private readonly propertyFilter: PropertyFilter;
    private readonly recordCategory: RecordCategory | null;
    private readonly setPropertyFilterOnOrganization: (propertyFilter: PropertyFilter | null) => void;
    private readonly setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => void;

    constructor({ propertyFilter, setPropertyFilterOnOrganization, setPropertyFilterOnGroup, recordCategory }: { propertyFilter: PropertyFilter;
        // to set or remove propertyFilter on the organization
        setPropertyFilterOnOrganization: (propertyFilter: PropertyFilter | null) => void;
        // to set the propertyFilter on the group
        setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => void;
        // only if the property filter is for a record category
        recordCategory: RecordCategory | null;
    }) {
        if (!PropertyFilterHandler.hasRegistrationFilter(propertyFilter)) {
            throw new Error('No registration filter found');
        }

        this.propertyFilter = propertyFilter;
        this.setPropertyFilterOnOrganization = setPropertyFilterOnOrganization;
        this.setPropertyFilterOnGroup = setPropertyFilterOnGroup;
        this.recordCategory = recordCategory;
    }

    static hasRegistrationFilter2(propertyFilter: PropertyFilter): boolean {
        return [propertyFilter.enabledWhen, propertyFilter.requiredWhen].some(filter => StamhoofdFilterHelper.hasRegistrationsFilter(filter));
    }

    static hasRegistrationFilter(propertyFilter: PropertyFilter): boolean {
        if (propertyFilter.requiredWhen && StamhoofdFilterHelper.hasRegistrationsFilter(propertyFilter.requiredWhen)) {
            if (propertyFilter.enabledWhen && StamhoofdFilterHelper.hasRegistrationsFilter(propertyFilter.enabledWhen)) {
                // case same filters
                if (JSON.stringify(propertyFilter.enabledWhen) === JSON.stringify(propertyFilter.requiredWhen)) {
                    // todo
                } else {
                    throw new Error('Registrations filter in requiredWhen not supported: ' + JSON.stringify(propertyFilter));
                }
            }
            /**
             * possible solution:
             * - configure for each group separately,
             * if groupId in filter then requiredWhen should be {}, else null (if no other filters)
             */
            // throw new Error('Registrations filter in requiredWhen not supported: ' + JSON.stringify(propertyFilter));
        }

        return StamhoofdFilterHelper.hasRegistrationsFilter(propertyFilter.enabledWhen);
    }

    /**
     * case enabledWhen null but requiredWhen not ->
     *  - set on EVERY group
     *  - remove from organization if not a category, else set defaultEnabled to false
     *
     * case enabledWhen not null but requiredWhen null ->
     * - only set on groups in enabledWhen filter
     * - remove from organization if not a category, else set defaultEnabled to false
     *
     * case enabledWhen not null and requiredWhen not null ->
     * - only set on groups in enabledWhen filter
     * - set requiredWhen depending on filter (different if groupId in filter or not)
     * - get propertyFilter for group and set requiredWhen?
     */

    private updateOrganization() {
        // property filter handler only can be created if there is a registration filter -> therefore no need to check
        // the organization should always be updated

        // if category -> set defaultEnabled to false
        if (this.recordCategory) {
            this.recordCategory.defaultEnabled = false;
            this.setPropertyFilterOnOrganization(new PropertyFilter(null, this.propertyFilter.requiredWhen));
            return;
        }

        this.setPropertyFilterOnOrganization(null);
    }

    private test(type: 'enabledWhen' | 'requiredWhen', newPropertyFilters: Map<string, PropertyFilter>) {
        const globalId = 'all';
        // const newPropertyFilters = new Map<string, PropertyFilter>();

        const filter = this.propertyFilter[type];
        const orFilters = StamhoofdFilterHelper.splitOrFilterFromRoot(filter);

        // make sure there are no other $or filters (else the filter possibly cannot be moved)
        orFilters.forEach((filter) => {
            // should not contain $or filter on deeper level than root (unless in registrations filter)
            try {
                StamhoofdFilterHelper.throwIfHasOrFilter(filter, ['registrations']);
            } catch (e) {
                console.error('Error:', e);
                console.error(`${type}: ${JSON.stringify(filter)}`);
                throw e;
            }
        });

        // todo: if without registrations filters -> set on EVERY group
        const globalFilters: StamhoofdFilter[] = [];
        const groupSpecificFilters: StamhoofdFilter[] = [];

        for (const filter of orFilters) {
            if (StamhoofdFilterHelper.hasRegistrationsFilter(filter)) {
                groupSpecificFilters.push(filter);
            } else {
                globalFilters.push(filter);
            }
        }

        if (globalFilters.length > 0) {
            const globalPropertyFilter = newPropertyFilters.get(globalId) ?? new PropertyFilter(null, null);
            // newPropertyFilters.set(globalId, new PropertyFilter(globalFilters, null));
            globalPropertyFilter[type] = globalFilters;
            // newPropertyFilters.set(globalId, globalPropertyFilter);
        }

        for (const groupSpecificFilter of groupSpecificFilters) {
            // todo: check groups where this filter applies

            // todo: use the merge method of PropertyFilter
        }
    }

    async handle() {
        const propertyFilter: PropertyFilter = this.propertyFilter;

        // if group filters and no or filters in parent
        const enabledWhen = propertyFilter.enabledWhen;
        if (enabledWhen === null) {
            throw new Error('Did not expect enabled when to be null');
        }

        const orFilters = StamhoofdFilterHelper.splitOrFilterFromRoot(enabledWhen);

        // make sure there are no other $or filters (else the filter possibly cannot be moved)
        orFilters.forEach((filter) => {
            // should not contain $or filter on deeper level than root (unless in registrations filter)
            try {
                StamhoofdFilterHelper.throwIfHasOrFilter(filter, ['registrations']);
            } catch (e) {
                console.error('Error:', e);
                console.error('enabledWhen:', JSON.stringify(enabledWhen));
                console.error('filter: ', JSON.stringify(filter));
                throw e;
            }
        });

        // todo: if without registrations filters -> set on EVERY group
        const withoutRegistrationFilters: StamhoofdFilter[] = [];
        const withRegistrationFilters: StamhoofdFilter[] = [];

        for (const filter of orFilters) {
            if (StamhoofdFilterHelper.hasRegistrationsFilter(filter)) {
                withRegistrationFilters.push(filter);
            } else {
                withoutRegistrationFilters.push(filter);
            }
        }

        if (withoutRegistrationFilters.length === 0) {
            // if category -> set defaultEnabled to false
            if (this.recordCategory) {
                this.recordCategory.defaultEnabled = false;
                this.setPropertyFilterOnOrganization(new PropertyFilter(null, propertyFilter.requiredWhen));
            } else {
                this.setPropertyFilterOnOrganization(null);
            }
        } else {
            /**
             * The property filter should remain on the organization.
             * Only the stamhoofd filters without registration filters should remain on the organization.
             */
            const newEnabledWhen: StamhoofdFilter = {
                $or: withoutRegistrationFilters,
            };
            this.setPropertyFilterOnOrganization(new PropertyFilter(newEnabledWhen, propertyFilter.requiredWhen));

            if (withRegistrationFilters.length > 0) {
                // todo
                throw new Error('there is a $or filter in the root with a combination of registration filters and other filters -> not sure how to handle yet');
            }
        }

        if (withRegistrationFilters.length > 1) {
            // these filters should be moved to the group

            // todo
            throw new Error('todo: implement');
        }
    }
}

class OrganizationHandler {
    constructor(readonly organization: Organization) {}

    async handle() {
        const propertyFilterHandlers = this.getAllPropertyFilterWrappers(this.organization);

        for (const propertyFilterHandler of propertyFilterHandlers) {
            await propertyFilterHandler.handle();
        }
    }

    private getAllRecordCategories(recordCategory: RecordCategory): RecordCategory[] {
        const childCategories = recordCategory.childCategories.flatMap(c => this.getAllRecordCategories(c));
        return [recordCategory, ...childCategories];
    }

    private getAllPropertyFilterWrappers(organization: Organization): PropertyFilterHandler[] {
        const recordsConfig: OrganizationRecordsConfiguration = organization.meta.recordsConfiguration;

        const propertyFilterWrappers: PropertyFilterHandler[] = [];

        for (const [key, value] of Object.entries(recordsConfig)) {
            if (value instanceof PropertyFilter) {
                try {
                    if (!PropertyFilterHandler.hasRegistrationFilter(value)) {
                        continue;
                    }
                } catch (e) {
                    console.error('Error:', e);
                    console.error('key:', key);
                    throw e;
                }

                propertyFilterWrappers.push(new PropertyFilterHandler({
                    propertyFilter: value,
                    setPropertyFilterOnOrganization: (propertyFilter) => {
                        this.organization.meta.recordsConfiguration[key] = propertyFilter;
                    },
                    setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => {
                        group.settings.recordsConfiguration[key] = propertyFilter;
                    },
                    recordCategory: null,
                }));
            }
        }

        const recordCategoryFilters: PropertyFilterHandler[] = recordsConfig.recordCategories
            .flatMap(category => this.getAllRecordCategories(category))
            .flatMap((category) => {
                const propertyFilter = category.filter;

                if (propertyFilter === null || !PropertyFilterHandler.hasRegistrationFilter(propertyFilter)) {
                    return [];
                }

                return new PropertyFilterHandler({
                    propertyFilter,
                    setPropertyFilterOnOrganization: (propertyFilter) => {
                        category.filter = propertyFilter;
                    },
                    setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => {
                        const map = group.settings.recordsConfiguration.inheritedRecordCategories;
                        map.set(category.id, propertyFilter);
                    },
                    recordCategory: category,
                });
            });

        return [...propertyFilterWrappers, ...recordCategoryFilters];
    }
}
