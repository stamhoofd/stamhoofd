import { Migration } from '@simonbackx/simple-database';
import { cloneObject } from '@simonbackx/simple-encoding';
import { Group, Organization } from '@stamhoofd/models';
import type { OrganizationRecordsConfiguration, RecordCategory, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { mergeFilters, PropertyFilter } from '@stamhoofd/structures';
// import fs from 'fs';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * IMPORTANT!
 * This migration should be run before the groups-registration-periods migration.
 */

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

    const dryRun = false;
    await startMigration(dryRun);
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
        if (filter === null) {
            return [null];
        }
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
                this._groupdIds = new Set(currentValue.map(item => RegistrationsFilterHandler.getGroupIdsFromGroupFilters(item)));
                break;
            } else {
                throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
            }
        }
    }

    private static getGroupIdsFromGroupFilters(filter: StamhoofdFilter) {
        const groupId = (filter as { group?: { id?: { $eq?: string } } })?.group?.id?.$eq;
        if (typeof groupId !== 'string') {
            throw new Error('Invalid group filter: ' + JSON.stringify(filter));
        }
        return groupId;
    }

    static getGroupIdsFromRegistrationsFilter(registrationFilter: { registrations: StamhoofdFilter }): string[] {
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
                return currentValue.map(item => this.getGroupIdsFromGroupFilters(item));
            } else {
                throw new Error('Invalid registration filter: ' + JSON.stringify(registrationFilter));
            }
        }
    }

    static getGroupIdsFromFilter(filter: StamhoofdFilter): string[] {
        if (!StamhoofdFilterHelper.isRecordOrArray(filter)) {
            throw new Error('Invalid filter: ' + JSON.stringify(filter));
        }

        if (Array.isArray(filter)) {
            return filter.flatMap(item => this.getGroupIdsFromFilter(item));
        }

        const all: string[] = [];

        for (const [key, value] of Object.entries(filter)) {
            if (key === 'registrations') {
                all.push(...this.getGroupIdsFromRegistrationsFilter({ [key]: value }));
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

                    all.push(...this.getGroupIdsFromFilter(item));
                }
                continue;
            }

            all.push(...this.getGroupIdsFromFilter(value));
        }

        return all;
    }
}

class PropertyFilterTracker {
    enabledWhen?: StamhoofdFilter;
    requiredWhen?: StamhoofdFilter;

    set(filter: StamhoofdFilter, type: 'enabledWhen' | 'requiredWhen', mergeType: '$and' | '$or'): void {
        if (this[type] === undefined) {
            this[type] = filter;
            return;
        }

        this[type] = StamhoofdFilterHelper.mergeFiltersOfPropertyFilter([this[type], filter], type, mergeType);
    }

    clone(): PropertyFilterTracker {
        const result = new PropertyFilterTracker();
        result.enabledWhen = cloneObject(this.enabledWhen);
        result.requiredWhen = cloneObject(this.requiredWhen);
        return result;
    }

    createPropertyFilter(): PropertyFilter {
        return new PropertyFilter(this.enabledWhen === undefined ? null : this.enabledWhen, this.requiredWhen === undefined ? null : this.requiredWhen);
    }

    static mergeIntoNew(a: PropertyFilterTracker, b: PropertyFilterTracker): PropertyFilterTracker {
        const enabledWhen = this.mergeFilters(a.enabledWhen, b.enabledWhen, { type: 'enabledWhen', mergeType: '$and' });
        const requiredWhen = this.mergeFilters(a.requiredWhen, b.requiredWhen, { type: 'requiredWhen', mergeType: '$and' });

        const result = new PropertyFilterTracker();
        result.enabledWhen = enabledWhen;
        result.requiredWhen = requiredWhen;
        return result;
    }

    private static mergeFilters(a: StamhoofdFilter | undefined, b: StamhoofdFilter | undefined, { type, mergeType }: { type: 'enabledWhen' | 'requiredWhen'; mergeType: '$and' | '$or' }): StamhoofdFilter | undefined {
        if (a === undefined && b === undefined) {
            return undefined;
        }

        if (a === undefined) {
            return b;
        }

        if (b === undefined) {
            return a;
        }

        return StamhoofdFilterHelper.mergeFiltersOfPropertyFilter([a, b], type, mergeType);
    }
}

class GroupsPropertyFiltersTracker {
    static readonly GLOBAL_KEY = 'all';

    // to apply in one of these groups (key can be GLOBAL_KEY if all groups)
    private readonly groupPropertyFiltersMap: Map<string, PropertyFilterTracker> = new Map();

    // to apply if not in one of these groups
    private readonly invertedGroupPropertyFiltersMap: Map<string, PropertyFilterTracker> = new Map();

    private hasEnabledWhenFilterOnlyRegistrationFilters: boolean | null = null;

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
            if (type === 'enabledWhen') {
                this.set({
                    key: GroupsPropertyFiltersTracker.GLOBAL_KEY,
                    type,
                    filter: StamhoofdFilterHelper.mergeFiltersOfPropertyFilter(globalFilters, type, '$or'),
                    isInverted: false,
                    mergeType: '$or',
                });
            } else {
                if (this.hasEnabledWhenFilterOnlyRegistrationFilters === null) {
                    throw new Error('hasEnabledWhenFilterOnlyRegistrationFilters is null, this should be set first');
                }

                if (this.hasEnabledWhenFilterOnlyRegistrationFilters) {
                    // override existing group specific filters
                    for (const [key, value] of this.groupPropertyFiltersMap) {
                        if (key === GroupsPropertyFiltersTracker.GLOBAL_KEY) {
                            continue;
                        }

                        value.requiredWhen = StamhoofdFilterHelper.mergeFiltersOfPropertyFilter(globalFilters, type, '$or');
                    }

                    // override existing inverted group specific filters
                    for (const [, value] of this.invertedGroupPropertyFiltersMap) {
                        value.requiredWhen = StamhoofdFilterHelper.mergeFiltersOfPropertyFilter(globalFilters, type, '$or');
                    }

                    if (groupSpecificFilters.length > 0) {
                        throw new Error('combination of group specific filters in enabledWhen and requiredWhen is not supported, :' + JSON.stringify(propertyFilter));
                    }

                    return;
                } else {
                    this.set({
                        key: GroupsPropertyFiltersTracker.GLOBAL_KEY,
                        type,
                        filter: StamhoofdFilterHelper.mergeFiltersOfPropertyFilter(globalFilters, type, '$or'),
                        isInverted: false,
                        mergeType: '$or',
                    });
                }
            }
        }

        const defaultValue = type === 'enabledWhen' ? null : {};

        for (const groupSpecificFilter of groupSpecificFilters) {
            const registrationFilterHandler = new RegistrationsFilterHandler(groupSpecificFilter);

            for (const groupId of registrationFilterHandler.groupIds.values()) {
                const otherFilters: StamhoofdFilter = registrationFilterHandler.otherFilters;
                const filter = Array.isArray(otherFilters) && otherFilters.length === 0 ? defaultValue : otherFilters;

                this.set({
                    key: groupId,
                    type,
                    filter,
                    isInverted: registrationFilterHandler.isInverted,
                    mergeType: '$or',
                });
            }
        }

        if (type === 'enabledWhen') {
            this.hasEnabledWhenFilterOnlyRegistrationFilters = globalFilters.length === 0 && groupSpecificFilters.length > 0;
        }
    }

    private set({ type, key, filter, isInverted, mergeType }: { type: 'enabledWhen' | 'requiredWhen'; key: string; filter: StamhoofdFilter; isInverted: boolean; mergeType: '$and' | '$or' }) {
        const map = isInverted ? this.invertedGroupPropertyFiltersMap : this.groupPropertyFiltersMap;
        let propertyFilterTracker: PropertyFilterTracker | undefined = map.get(key);
        if (propertyFilterTracker === undefined) {
            propertyFilterTracker = new PropertyFilterTracker();
            map.set(key, propertyFilterTracker);
        }

        propertyFilterTracker.set(filter, type, mergeType);
    }

    private get globalPropertyFilter(): PropertyFilterTracker | undefined {
        return this.groupPropertyFiltersMap.get(GroupsPropertyFiltersTracker.GLOBAL_KEY);
    }

    private groupInvertedFiltersCache: Map<string, { tracker: PropertyFilterTracker; groups: string[] }> | null = null;

    private groupInvertedFilters(): Map<string, { tracker: PropertyFilterTracker; groups: string[] }> {
        if (this.groupInvertedFiltersCache) {
            return this.groupInvertedFiltersCache;
        }

        const result = new Map<string, { tracker: PropertyFilterTracker; groups: string[] }>();
        for (const [key, value] of this.invertedGroupPropertyFiltersMap) {
            const stringified = JSON.stringify(value);
            let data = result.get(stringified);
            if (!data) {
                data = { tracker: value, groups: [] };
                result.set(stringified, data);
            }
            data.groups.push(key);
        }

        this.groupInvertedFiltersCache = result;

        return result;
    }

    /**
     * Merges all property filters for the given group
     * @param group
     * @returns
     */
    getPropertyFilterForGroup(group: Group): PropertyFilter | null {
        const allPropertyFilterTrackers: PropertyFilterTracker[] = [];
        const globalPropertyFilter = this.globalPropertyFilter;
        if (globalPropertyFilter) {
            allPropertyFilterTrackers.push(globalPropertyFilter);
        }

        const groupSpecific = this.groupPropertyFiltersMap.get(group.id);
        if (groupSpecific) {
            allPropertyFilterTrackers.push(groupSpecific);
        }

        if (this.invertedGroupPropertyFiltersMap.size > 0) {
            const groupInvertedFilters = this.groupInvertedFilters();
            for (const [, value] of groupInvertedFilters) {
                if (!value.groups.includes(group.id)) {
                    allPropertyFilterTrackers.push(value.tracker);
                }
            }
        }

        if (allPropertyFilterTrackers.length === 0) {
            return null;
        }

        const first = allPropertyFilterTrackers[0];
        let result = first.clone();

        for (const propertyFilter of allPropertyFilterTrackers.slice(1)) {
            result = PropertyFilterTracker.mergeIntoNew(result, propertyFilter);
        }

        return result.createPropertyFilter();
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

    static async shouldHandlePropertyFilter(propertyFilter: PropertyFilter): Promise<boolean> {
        if (StamhoofdFilterHelper.hasRegistrationsFilter(propertyFilter.enabledWhen)) {
            return true;
        }

        // to make sure logic is ok
        if (!StamhoofdFilterHelper.hasRegistrationsFilter(propertyFilter.requiredWhen)) {
            return false;
        }

        const groupIds = RegistrationsFilterHandler.getGroupIdsFromFilter(propertyFilter.requiredWhen);
        if (groupIds.length === 0) {
            // should never happen, if this happens there is a bug
            throw new Error('No groupIds found: ' + JSON.stringify(propertyFilter));
        }

        // if only registration filters in requiredwhen -> check if at least one group exists
        const groups = await Group.select().where('id', groupIds).where('deletedAt', null).count();

        const shouldHandleFilter = groups !== 0;

        if (!shouldHandleFilter) {
            const orFilters = StamhoofdFilterHelper.splitOrFilterFromRoot(propertyFilter.requiredWhen);
            if (orFilters.length > 1) {
                // or filters are not supported for now
                throw new Error('Only one or filter expected: ' + JSON.stringify(propertyFilter));
            }
            propertyFilter.requiredWhen = null;
        }

        return shouldHandleFilter;
    }

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
    private static readonly organizionIdsToLog = new Set();
    private readonly logInfo = new Map<string, Map<string, Set<string>>>();
    private static readonly FILE_PATH: string = 'property-filter-changes.txt';
    static readonly SHOULD_LOG = false;
    private shouldLog = PropertyChangesLoggerHelper.SHOULD_LOG;

    static didInitOneTime = false;

    constructor(private readonly organization: Organization, private readonly propertyFilterHandlers: PropertyFilterHandler[]) {
        if (!PropertyChangesLoggerHelper.didInitOneTime) {
            PropertyChangesLoggerHelper.didInitOneTime = true;
            // clear output

            // fs.writeFileSync(PropertyChangesLoggerHelper.FILE_PATH, '');
            throw new Error('not implemented');
        }

        if (!this.shouldLog) {
            this.shouldLog = PropertyChangesLoggerHelper.organizionIdsToLog.has(this.organization.id);
        }
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
            // fs.appendFileSync(PropertyChangesLoggerHelper.FILE_PATH, text);
            throw new Error('not implemented');
        } catch (err) {
            console.error('Error writing file:', err);
        }
    }

    static shouldLog(organization: Organization): boolean {
        if (this.SHOULD_LOG) {
            return true;
        }

        return PropertyChangesLoggerHelper.organizionIdsToLog.has(organization.id);
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
                            groups: [...groups],
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
        const propertyFilterHandlers = await this.getAllPropertyFilterHandlers(this.organization);
        if (propertyFilterHandlers.length === 0) {
            return;
        }

        const query = Group.select().where('organizationId', this.organization.id).where('deletedAt', null);

        let skipGroups = false;

        if (!propertyFilterHandlers.some(handler => handler.groupPropertyFiltersTracker.shouldUpdateAllGroups)) {
            const allGroupIds = new Set<string>(propertyFilterHandlers.flatMap(handler => handler.groupPropertyFiltersTracker.groupIdsToUpdate));
            if (allGroupIds.size === 0) {
                // can happen if an empty registrations filter
                skipGroups = false;
            } else {
                query.where('id', [...allGroupIds]);
            }
        }

        for (const propertyFilterHandler of propertyFilterHandlers) {
            propertyFilterHandler.handleOrganization();
        }

        const changesLogger = new PropertyChangesLoggerHelper(this.organization, propertyFilterHandlers);

        if (!skipGroups) {
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

    private async getAllPropertyFilterHandlers(organization: Organization): Promise<PropertyFilterHandler[]> {
        const recordsConfig: OrganizationRecordsConfiguration = organization.meta.recordsConfiguration;

        const propertyFilterWrappers: PropertyFilterHandler[] = [];

        function handlePropertyFilterHandlerError(e: any, name: string) {
            const test: Record<string, string[]> = {
                // fixed manually
                ['da9a913a-feea-4a82-9335-2788babe39a9']: ['nationalRegisterNumber', 'Gegevens Fiscale attesten kinderopvang', 'Rijden naar Bornem'],
                // fixed manually
                ['528a4d8e-7347-4483-ab99-07d0ece78d17']: ['Instrument'],
                // fixed manually
                ['6b4f8185-05ca-4b03-b244-fb9c7d5c81ae']: ['Privacy'],
                // fixed manually
                ['bf4600a6-e308-4e28-adcb-9976216cb73a']: ['Kind'],
            };

            const testSkip = new Set([...Object.entries(test)].flatMap(([k, v]) => v.map(x => k + x)));
            const messagesToSkip = [
                // todo: skipped for now but should be handled
                // 'Found more than one registrations filter',
                // todo: skipped for now but should be handled
                // 'The $and filter is not supported',
            ];
            // todo: skipped for now but should be handled
            if (messagesToSkip.some(m => e?.message?.includes?.(m)) || testSkip.has(organization.id + name)) {
                console.error('ignored error:');
                console.error(e);
                return;
            }

            console.error('organization:', organization.id);
            console.error('name:', name);

            throw e;
        }

        for (const [key, value] of Object.entries(recordsConfig)) {
            if (value instanceof PropertyFilter) {
                try {
                    const shouldHandle = await PropertyFilterHandler.shouldHandlePropertyFilter(value);
                    if (!shouldHandle) {
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
                    handlePropertyFilterHandlerError(e, key);
                }
            }
        }

        const recordCategoryFilters: PropertyFilterHandler[] = [];

        for (const category of recordsConfig.recordCategories.flatMap(category => this.getAllRecordCategories(category))) {
            const propertyFilter = category.filter;

            if (propertyFilter === null) {
                continue;
            }

            const shouldHandle = await PropertyFilterHandler.shouldHandlePropertyFilter(propertyFilter);
            if (!shouldHandle) {
                continue;
            }

            try {
                recordCategoryFilters.push(new PropertyFilterHandler({
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
                }));
            } catch (e) {
                handlePropertyFilterHandlerError(e, category.name.toString());
            }
        }

        return [...propertyFilterWrappers, ...recordCategoryFilters];
    }
}
