import { Migration } from '@simonbackx/simple-database';
import { cloneObject } from '@simonbackx/simple-encoding';
import { Group, Organization } from '@stamhoofd/models';
import type { OrganizationRecordsConfiguration, RecordCategory, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { mergeFilters, PropertyFilter } from '@stamhoofd/structures';
import fs from 'fs';
import { SeedTools } from '../helpers/SeedTools.js';

export async function startMigration(dryRun = false) {
    await SeedTools.loop({
        batchSize: 100,
        query: Organization.select(),
        action: async (organization: Organization) => {
            const organizationHandler = new OrganizationHandler(organization);
            await organizationHandler.handle(dryRun);
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

    const dryRun = true;
    await startMigration(dryRun);
    throw new Error('test');
});

class StamhoofdFilterHelper {
    static mergeFiltersOfPropertyFilter(filters: (StamhoofdFilter | null)[], propertyFilterType: 'enabledWhen' | 'requiredWhen', mergeType?: '$and' | '$or'): StamhoofdFilter | null {
        if (propertyFilterType === 'requiredWhen' && filters.some(filter => StamhoofdFilterHelper.isEmptyRecord(filter))) {
            // always required if empty record
            return {};
        }

        return mergeFilters(filters, mergeType);
    }

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

    static splitOrFilterFromRoot(filter: StamhoofdFilter): StamhoofdFilter[] {
        if (!this.isRecord(filter)) {
            throw new Error('The root should be a record: ' + JSON.stringify(filter));
        }

        const entries = Object.entries(filter);
        if (entries.length > 1) {
            // in theory could be possible but this is not expected based on the data -> we do not support this
            throw new Error('The root unexepctedly has more than one entry');
        }

        if (entries.length === 0) {
            return [filter];
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
    private _isInverted: boolean = false;
    private _groupdIds: Set<string> | null = null;
    private _otherFilters: StamhoofdFilter[] | null = null;
    private _didFindRegistrationsFilter = false;

    get isInverted() {
        return this._isInverted;
    }

    get groupIds() {
        return this._groupdIds!;
    }

    get otherFilters() {
        return this._otherFilters!;
    }

    constructor(private readonly filter: StamhoofdFilter) {
        this.initFromFilter(filter);
    }

    private initFromFilter(filter: StamhoofdFilter) {
        this._otherFilters = this.readAndFlattenFilter(filter, false);

        if (this._groupdIds === null) {
            throw new Error('groupdIds is null');
        }

        if (this._otherFilters === null) {
            throw new Error('otherFilters is null');
        }

        if (this._didFindRegistrationsFilter === false) {
            throw new Error('didFindRegistrationsFilter is false');
        }
    }

    /**
     * Reads data from registration filter and return an array of other filters as a flat array
     * @param filter
     */
    private readAndFlattenFilter(filter: StamhoofdFilter, isInverted: boolean): StamhoofdFilter[] {
        // filter should not contain any $or filters

        if (!StamhoofdFilterHelper.isRecordOrArray(filter)) {
            throw new Error('Invalid filter: ' + JSON.stringify(filter));
        }

        if (Array.isArray(filter)) {
            return filter.flatMap(item => this.readAndFlattenFilter(item, isInverted));
        }

        const all: StamhoofdFilter[] = [];

        for (const [key, value] of Object.entries(filter)) {
            if (key === '$or') {
                throw new Error('The $or filter is not supported');
            }

            if (key === '$not') {
                if (isInverted) {
                    throw new Error('Double inversion, check filter: ' + JSON.stringify(this.filter));
                }
                isInverted = true;
            }

            if (key === 'registrations') {
                if (isInverted) {
                    this._isInverted = true;
                }

                this.readRegistrationFilter({ [key]: value });
                this._didFindRegistrationsFilter = true;
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

                    all.push(...this.readAndFlattenFilter(item, isInverted).map(filter => ({ [key]: filter })));
                }
                continue;
            }

            all.push(...this.readAndFlattenFilter(value, isInverted).map(filter => ({ [key]: filter })));
        }

        return all;
    }

    private readRegistrationFilter(registrationFilter: { registrations: StamhoofdFilter }): void {
        if (this._didFindRegistrationsFilter) {
            throw new Error('Found more than one registrations filter: ' + JSON.stringify(this.filter));
        }

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
                {
                    break;
                }
                case '$not': {
                    if (this._isInverted === true) {
                        throw new Error('Double inversion, check filter: ' + JSON.stringify(this.filter));
                    }
                    this._isInverted = true;
                    break;
                }
                case '$and': {
                    const array = currentEntry[1];

                    // only support 1 item
                    if (!Array.isArray(array)) {
                        throw new Error(`The $and filter is not an array, check filter: ${JSON.stringify(this.filter)}`);
                    }

                    // only support 1 item (because the mode does not matter in that case)
                    if (array.length < 2) {
                        break;
                    }

                    // or is default mode
                    throw new Error(`The $and filter is not supported, check filter: ${JSON.stringify(this.filter)}`);
                }
                default: throw new Error(`Invalid registration filter (currentKey: ${currentKey}): ` + JSON.stringify(registrationFilter));
            }

            const currentValue = currentEntry[1];

            if (StamhoofdFilterHelper.isRecordWithSingleEntry(currentValue)) {
                currentEntry = Object.entries(currentValue)[0];
            } else if (Array.isArray(currentValue)) {
                this._groupdIds = new Set(currentValue.map(item => this.getGroupIdsFromGroupFilters(item)));
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

class GroupsPropertyFiltersTracker {
    static readonly GLOBAL_KEY = 'all';

    // to apply in one of these groups (key can be GLOBAL_KEY if all groups)
    private readonly groupPropertyFiltersMap: Map<string, PropertyFilter> = new Map();

    // to apply if not in one of these groups
    private readonly invertedGroupPropertyFiltersMap: Map<string, PropertyFilter> = new Map();

    constructor(propertyFilter: PropertyFilter) {
        (['enabledWhen', 'requiredWhen'] as ('enabledWhen' | 'requiredWhen')[]).forEach(type => this.updateFromFilter(propertyFilter, type));
    }

    get shouldUpdateAllGroups() {
        return this.groupPropertyFiltersMap.has(GroupsPropertyFiltersTracker.GLOBAL_KEY) || this.invertedGroupPropertyFiltersMap.size > 0;
    }

    get groupIdsToUpdate(): string[] {
        return [...this.groupPropertyFiltersMap.keys()].filter(key => key !== GroupsPropertyFiltersTracker.GLOBAL_KEY);
    }

    private updateFromFilter(propertyFilter: PropertyFilter, type: 'enabledWhen' | 'requiredWhen') {
        if (propertyFilter[type] === null) {
            this.set({
                key: GroupsPropertyFiltersTracker.GLOBAL_KEY,
                type,
                filter: null,
                isInverted: false,
                mergeType: '$or',
            });
            return;
        }

        // clone to prevent side effects
        const filter = cloneObject(propertyFilter[type]);
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
            this.set({
                key: GroupsPropertyFiltersTracker.GLOBAL_KEY,
                type,
                filter: StamhoofdFilterHelper.mergeFiltersOfPropertyFilter(globalFilters, type, '$or'),
                isInverted: false,
                mergeType: '$or',
            });
        }

        for (const groupSpecificFilter of groupSpecificFilters) {
            const registrationFilterHandler = new RegistrationsFilterHandler(groupSpecificFilter);

            for (const groupId of registrationFilterHandler.groupIds.values()) {
                this.set({
                    key: groupId,
                    type,
                    filter: registrationFilterHandler.otherFilters,
                    isInverted: registrationFilterHandler.isInverted,
                    mergeType: '$or',
                });
            }
        }
    }

    private set({ type, key, filter, isInverted, mergeType }: { type: 'enabledWhen' | 'requiredWhen'; key: string; filter: StamhoofdFilter; isInverted: boolean; mergeType: '$and' | '$or' }) {
        const map = isInverted ? this.invertedGroupPropertyFiltersMap : this.groupPropertyFiltersMap;
        let propertyFilter: PropertyFilter | undefined = map.get(key);
        if (!propertyFilter) {
            propertyFilter = new PropertyFilter(null, null);
            map.set(key, propertyFilter);
        }

        const currentFilter: StamhoofdFilter = propertyFilter[type];
        if (currentFilter === null) {
            propertyFilter[type] = filter;
            return;
        }

        propertyFilter[type] = StamhoofdFilterHelper.mergeFiltersOfPropertyFilter([currentFilter, filter], type, mergeType);
    }

    private get globalPropertyFilter(): PropertyFilter | undefined {
        return this.groupPropertyFiltersMap.get(GroupsPropertyFiltersTracker.GLOBAL_KEY);
    }

    /**
     * Merges all property filters for the given group
     * @param group
     * @returns
     */
    getPropertyFilterForGroup(group: Group): PropertyFilter | null {
        const allPropertyFilters: PropertyFilter[] = [];
        const globalPropertyFilter = this.globalPropertyFilter;
        if (globalPropertyFilter) {
            allPropertyFilters.push(globalPropertyFilter);
        }

        const groupSpecific = this.groupPropertyFiltersMap.get(group.id);
        if (groupSpecific) {
            allPropertyFilters.push(groupSpecific);
        }

        for (const [key, value] of this.invertedGroupPropertyFiltersMap.entries()) {
            if (key !== group.id) {
                allPropertyFilters.push(value);
            }
        }

        if (allPropertyFilters.length === 0) {
            return null;
        }

        const first = allPropertyFilters[0].clone();

        // todo: not sure if merge works as expected -> test
        for (const propertyFilter of allPropertyFilters.slice(1)) {
            first.merge(propertyFilter);
        }

        return first;
    }
}

class PropertyFilterHandler {
    readonly name: string;
    private readonly propertyFilter: PropertyFilter;
    private readonly recordCategory: RecordCategory | null;
    private readonly setPropertyFilterOnOrganization: (propertyFilter: PropertyFilter | null) => void;
    private readonly setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => void;
    readonly groupPropertyFiltersTracker: GroupsPropertyFiltersTracker;

    get original(): PropertyFilter {
        return this.propertyFilter.clone();
    }

    constructor({ name, propertyFilter, setPropertyFilterOnOrganization, setPropertyFilterOnGroup, recordCategory }: {
        // name is only used for logging
        name: string; propertyFilter: PropertyFilter;
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

        this.name = name;
        this.propertyFilter = propertyFilter;
        this.setPropertyFilterOnOrganization = setPropertyFilterOnOrganization;
        this.setPropertyFilterOnGroup = setPropertyFilterOnGroup;
        this.recordCategory = recordCategory;
        this.groupPropertyFiltersTracker = new GroupsPropertyFiltersTracker(propertyFilter);
    }

    static hasRegistrationFilter(propertyFilter: PropertyFilter): boolean {
        return [propertyFilter.enabledWhen, propertyFilter.requiredWhen].some(filter => StamhoofdFilterHelper.hasRegistrationsFilter(filter));
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

    handleOrganization() {
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

    handleGroup(group: Group): PropertyFilter | null {
        const propertyFilter = this.groupPropertyFiltersTracker.getPropertyFilterForGroup(group);

        if (propertyFilter) {
            this.setPropertyFilterOnGroup(group, propertyFilter);
        }

        return propertyFilter;
    }
}

/**
 * Only for testing purposes
 */
class PropertyChangesLoggerHelper {
    private static readonly organizionIdsToLog = new Set(['02ef5b71-da8c-4046-abc1-481fbda74e3a']);
    private readonly logInfo = new Map<string, Map<string, Set<string>>>();
    private static readonly FILE_PATH: string = 'property-filter-changes.txt';
    private shouldLog = false;

    static didInitOneTime = false;

    constructor(private readonly organization: Organization, private readonly propertyFilterHandlers: PropertyFilterHandler[]) {
        if (!PropertyChangesLoggerHelper.didInitOneTime) {
            PropertyChangesLoggerHelper.didInitOneTime = true;
            // clear output
            fs.writeFileSync(PropertyChangesLoggerHelper.FILE_PATH, '');
        }

        this.shouldLog = PropertyChangesLoggerHelper.organizionIdsToLog.has(this.organization.id);
    }

    add(name: string, group: Group, propertyFilter: PropertyFilter | null) {
        if (!this.shouldLog) {
            return;
        }

        let filterMap = this.logInfo.get(name);
        if (!filterMap) {
            filterMap = new Map<string, Set<string>>();
            this.logInfo.set(name, filterMap);
        }

        const propertyFilterText = JSON.stringify(propertyFilter);

        let groups = filterMap.get(propertyFilterText);
        if (!groups) {
            groups = new Set();
            filterMap.set(propertyFilterText, groups);
        }

        groups.add(group.id);
    }

    private logTextToFile(text: string) {
        try {
            fs.appendFileSync(PropertyChangesLoggerHelper.FILE_PATH, text);
        } catch (err) {
            console.error('Error writing file:', err);
        }
    }

    doLog() {
        if (!this.shouldLog) {
            return;
        }

        const changed = [...this.logInfo.entries()].map(([name, filterMap]) => {
            const original = this.propertyFilterHandlers.find(handler => handler.name === name)!.original;

            return {
                [name]: {
                    original,
                    changes: [...filterMap.entries()].map(([propertyFilterText, groups]) => {
                        return {
                            propertyFilter: propertyFilterText,
                            groups: groups.size < 10 ? [...groups] : groups.size,
                        };
                    }) },
            };
        });

        const allInfo = {
            organization: {
                id: this.organization.id,
                name: this.organization.name,
            },
            changed,
        };

        this.logTextToFile(JSON.stringify(allInfo) + ',');
    }
}

class OrganizationHandler {
    constructor(readonly organization: Organization) {}

    async handle(dryRun = false) {
        const propertyFilterHandlers = this.getAllPropertyFilterHandlers(this.organization);
        if (propertyFilterHandlers.length === 0) {
            return;
        }

        // todo: add extra filters to limit amount of groups?
        const query = Group.select().where('organizationId', this.organization.id);

        if (!propertyFilterHandlers.some(handler => handler.groupPropertyFiltersTracker.shouldUpdateAllGroups)) {
            const allGroupIds = new Set<string>(propertyFilterHandlers.flatMap(handler => handler.groupPropertyFiltersTracker.groupIdsToUpdate));
            query.where('id', [...allGroupIds]);
        }

        for (const propertyFilterHandler of propertyFilterHandlers) {
            propertyFilterHandler.handleOrganization();
        }

        const changesLogger = new PropertyChangesLoggerHelper(this.organization, propertyFilterHandlers);

        // todo: take into account cycles (or do this before the registration periods migration for better performance)
        for await (const group of query.all()) {
            for (const propertyFilterHandler of propertyFilterHandlers) {
                const propertyFilter = propertyFilterHandler.handleGroup(group);
                changesLogger.add(propertyFilterHandler.name, group, propertyFilter);
            }

            if (!dryRun) {
                await group.save();
            }
        }

        if (!dryRun) {
            await this.organization.save();
        }

        changesLogger.doLog();
    }

    private getAllRecordCategories(recordCategory: RecordCategory): RecordCategory[] {
        const childCategories = recordCategory.childCategories.flatMap(c => this.getAllRecordCategories(c));
        return [recordCategory, ...childCategories];
    }

    private getAllPropertyFilterHandlers(organization: Organization): PropertyFilterHandler[] {
        const recordsConfig: OrganizationRecordsConfiguration = organization.meta.recordsConfiguration;

        const propertyFilterWrappers: PropertyFilterHandler[] = [];

        function handlePropertyFilterHandlerError(e: any) {
            const messagesToSkip = [
                // todo: skipped for now but should be handled
                'Found more than one registrations filter',
                // todo: skipped for now but should be handled
                'The $and filter is not supported',
            ];
            // todo: skipped for now but should be handled
            if (messagesToSkip.some(m => e?.message?.includes?.(m))) {
                console.error('ignored error:');
                console.error(e);
                return;
            }

            throw e;
        }

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

                try {
                    propertyFilterWrappers.push(new PropertyFilterHandler({
                        name: key,
                        propertyFilter: value,
                        setPropertyFilterOnOrganization: (propertyFilter) => {
                            this.organization.meta.recordsConfiguration[key] = propertyFilter;
                        },
                        setPropertyFilterOnGroup: (group: Group, propertyFilter: PropertyFilter) => {
                            group.settings.recordsConfiguration[key] = propertyFilter;
                        },
                        recordCategory: null,
                    }));
                } catch (e) {
                    handlePropertyFilterHandlerError(e);
                }
            }
        }

        const recordCategoryFilters: PropertyFilterHandler[] = recordsConfig.recordCategories
            .flatMap(category => this.getAllRecordCategories(category))
            .flatMap((category) => {
                const propertyFilter = category.filter;

                if (propertyFilter === null || !PropertyFilterHandler.hasRegistrationFilter(propertyFilter)) {
                    return [];
                }

                try {
                    return new PropertyFilterHandler({
                        name: category.name.toString(),
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
                } catch (e) {
                    handlePropertyFilterHandlerError(e);
                    return [];
                }
            });

        return [...propertyFilterWrappers, ...recordCategoryFilters];
    }
}
