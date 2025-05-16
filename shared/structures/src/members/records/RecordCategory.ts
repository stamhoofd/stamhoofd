import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, PatchMap, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { StamhoofdFilter } from '../../filters/StamhoofdFilter.js';
import { getPermissionLevelNumber, PermissionLevel } from '../../PermissionLevel.js';
import { ObjectWithRecords, PatchAnswers } from '../ObjectWithRecords.js';
import { RecordFilterOptions, RecordSettings } from './RecordSettings.js';
import { TranslatedString } from '../../TranslatedString.js';

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean;
}

export class RecordCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    name = TranslatedString.create();

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    description = TranslatedString.create();

    /**
     * Sometimes a category needs to be in the list but not enabled.
     * E.g. when decendants can enable it optionally and share the data
     */
    @field({ decoder: BooleanDecoder, version: 255 })
    defaultEnabled = true;

    /**
     * A category can either have childCategories or records, but never both. Records are ignored as soon as the category has at least one child category.
     * Currently we only support 2 categories deep
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    childCategories: RecordCategory[] = [];

    @field({ decoder: new ArrayDecoder(RecordSettings) })
    records: RecordSettings[] = [];

    @field({ decoder: PropertyFilter, version: 126, nullable: true, optional: true })
    filter: PropertyFilter | null = null;

    get containsSensitiveData() {
        return !!this.getAllRecords().find(r => r.sensitive);
    }

    getAllRecords(): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [...this.childCategories.flatMap(c => c.getAllRecords()), ...this.records];
        }
        return this.records;
    }

    getAllFilteredRecords<T extends ObjectWithRecords>(filterValue: T, options?: RecordFilterOptions): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [
                ...this.filterChildCategories(filterValue).flatMap(c => c.getAllFilteredRecords(filterValue, options)),
                ...this.filterRecords(filterValue, options),
            ];
        }
        return this.filterRecords(filterValue, options);
    }

    filterRecords<T extends ObjectWithRecords>(filterValue: T, options?: RecordFilterOptions): RecordSettings[] {
        return this.records.filter(r => r.isEnabled(filterValue, options));
    }

    validate<T extends ObjectWithRecords>(value: T) {
        // check if everything has been answered already + check out of date
        const requiredCategory = this.isRequired(value);

        // Check all the properties in this category and check their last review times
        const errors = new SimpleErrors();

        for (const record of this.getAllFilteredRecords(value)) {
            try {
                record.validate(value.getRecordAnswers(), requiredCategory);
            }
            catch (e) {
                if (isSimpleErrors(e) || isSimpleError(e)) {
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }
        errors.throwIfNotEmpty();
    }

    isComplete<T extends ObjectWithRecords>(value: T, outdatedTime: number | null = null, options?: RecordFilterOptions) {
        // check if everything has been answered already + check out of date
        const records = this.getAllFilteredRecords(value, options);

        // Check all the properties in this category and check their last review times
        for (const record of records) {
            const answer = value.getRecordAnswers().get(record.id);
            if (!answer) {
                // This was never answered
                return false;
            }

            if (outdatedTime !== null) {
                if (answer.isOutdated(outdatedTime)) {
                    // This answer is outdated
                    return false;
                }
            }

            try {
                answer.validate();
            }
            catch (e) {
                // This answer is not valid anymore
                return false;
            }
        }
        return true;
    }

    getTotalRecords<T extends ObjectWithRecords>(value: T): number {
        return this.getAllFilteredRecords(value).length;
    }

    getTotalCompleteRecords<T extends ObjectWithRecords>(value: T): number {
        // check if everything has been answered already + check out of date
        const records = this.getAllFilteredRecords(value);
        let count = 0;

        // Check all the properties in this category and check their last review times
        for (const record of records) {
            const answer = value.getRecordAnswers().get(record.id);
            if (!answer) {
                // This was never answered
                continue;
            }

            try {
                answer.validate();
                count += 1;
            }
            catch (e) {
                // This answer is not valid anymore
            }
        }
        return count;
    }

    isEnabled<T extends ObjectWithRecords>(filterValue: T, ignoreFilter = false, filterOptions?: RecordFilterOptions) {
        if (!ignoreFilter) {
            if (!this.defaultEnabled) {
                return false;
            }
            if (this.filter && !this.filter.isEnabled(filterValue)) {
                return false;
            }
        }

        if (this.childCategories.length > 0) {
            if (this.filterChildCategories(filterValue, filterOptions).length > 0) {
                return true;
            }
        }

        if (this.filterRecords(filterValue, filterOptions).length > 0) {
            return true;
        }

        return false;
    }

    get externalPermissionLevel(): PermissionLevel {
        const maximumPermissionLevel = this.getAllRecords().reduce((max, record) => {
            const recordPermissionLevel = record.externalPermissionLevel;
            if (getPermissionLevelNumber(recordPermissionLevel) > getPermissionLevelNumber(max)) {
                return recordPermissionLevel;
            }
            return max;
        }, PermissionLevel.None);

        return maximumPermissionLevel;
    }

    checkPermissionForUserManager(level: PermissionLevel): boolean {
        const levelNumber = getPermissionLevelNumber(level);
        const hasPermission = this.records.some(r => getPermissionLevelNumber(r.externalPermissionLevel) >= levelNumber);
        if (hasPermission) {
            return true;
        }

        if (this.childCategories.length) {
            return this.childCategories.some(c => c.checkPermissionForUserManager(level));
        }
        return false;
    }

    isRequired<T extends ObjectWithRecords>(filterValue: T) {
        if (!this.filter || this.filter.isRequired(filterValue)) {
            return true;
        }
        return false;
    }

    static filterCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T, filterOptions?: RecordFilterOptions): RecordCategory[] {
        return categories.filter((category) => {
            return category.isEnabled(filterValue, false, filterOptions);
        });
    }

    filterChildCategories<T extends ObjectWithRecords>(filterValue: T, filterOptions?: RecordFilterOptions): RecordCategory[] {
        return RecordCategory.filterCategories(this.childCategories, filterValue, filterOptions);
    }

    /**
     * Flatten all categories and child categories into a single array
     */
    static flattenCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T, options?: RecordFilterOptions): RecordCategory[] {
        return RecordCategory.filterCategories(
            categories,
            filterValue,
            options,
        ).flatMap((cat) => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat);
            cat2.childCategories = [];
            cat2.records = cat2.filterRecords(filterValue, options);

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategories(cat.childCategories, filterValue, options).map((c) => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c);
                        cc.name = cat.name.append(' → ', c.name);
                        return cc;
                    }),
                ];
            }
            return (cat2.records.length > 0 ? [cat2] : []);
        });
    }

    /**
     * Get a flat array with record categories whose records match the filter
     */
    static flattenCategoriesWith(categories: RecordCategory[], filter: (record: RecordSettings) => boolean): RecordCategory[] {
        return categories.flatMap((cat) => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat);

            const updatedRecords = cat.records.filter((r) => {
                return filter(r);
            });

            cat2.records = updatedRecords;

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                cat2.childCategories = [];
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategoriesWith(cat.childCategories, filter).map((c) => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c);
                        cc.name = cat.name.append(' → ', c.name);
                        return cc;
                    }),
                ];
            }
            return cat2.records.length > 0 ? [cat2] : [];
        });
    }

    /**
     * Remove (child) categories that don't have a record that matches the filter
     */
    static filterRecordsWith(categories: RecordCategory[], filter: (record: RecordSettings) => boolean): RecordCategory[] {
        return categories.flatMap((cat) => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat);

            const updatedRecords = cat.records.filter((r) => {
                return filter(r);
            });

            cat2.records = updatedRecords;
            cat2.childCategories = this.filterRecordsWith(cat.childCategories, filter);
            return cat2.records.length > 0 || cat2.childCategories.length > 0 ? [cat2] : [];
        });
    }

    static validate<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T) {
        const filteredCategories = RecordCategory.filterCategories(categories, filterValue);
        const errors = new SimpleErrors();

        // Delete all records that are not in the list
        for (const category of filteredCategories) {
            try {
                category.validate(filterValue);
            }
            catch (e) {
                if (isSimpleErrors(e) || isSimpleError(e)) {
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }
        errors.throwIfNotEmpty();
    }

    static removeOldAnswers<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T, filterOptions?: RecordFilterOptions): T {
        const answers = filterValue.getRecordAnswers();
        const filteredCategories = RecordCategory.filterCategories(categories, filterValue, filterOptions);
        const records = filteredCategories.flatMap(c => c.getAllFilteredRecords(filterValue, filterOptions));
        const patch: PatchAnswers = new PatchMap();

        // Remove all answers not in the list
        for (const [id, _] of answers) {
            if (!records.find(r => r.id === id)) {
                patch.set(id, null);
            }
        }

        return filterValue.patchRecordAnswers(patch);
    }

    duplicate() {
        const c = this.clone();

        c.id = uuidv4();

        c.childCategories = this.childCategories.map(c => c.duplicate());
        c.records = this.records.map(r => r.duplicate());

        return c;
    }
}
