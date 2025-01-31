import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { StamhoofdFilter } from '../../filters/StamhoofdFilter.js';
import { getPermissionLevelNumber, PermissionLevel } from '../../PermissionLevel.js';
import { ObjectWithRecords } from '../ObjectWithRecords.js';
import { RecordAnswer } from './RecordAnswer.js';
import { RecordSettings } from './RecordSettings.js';

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean;
}

export class RecordCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

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

    getAllFilteredRecords<T extends ObjectWithRecords>(filterValue: T, checkUserManagerPermissions?: { level: PermissionLevel }): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [
                ...this.filterChildCategories(filterValue).flatMap(c => c.getAllFilteredRecords(filterValue, checkUserManagerPermissions)),
                ...this.filterRecords(filterValue, checkUserManagerPermissions),
            ];
        }
        return this.filterRecords(filterValue, checkUserManagerPermissions);
    }

    filterRecords<T extends ObjectWithRecords>(filterValue: T, checkUserManagerPermissions?: { level: PermissionLevel }): RecordSettings[] {
        if (checkUserManagerPermissions) {
            const level = checkUserManagerPermissions.level;
            return this.records.filter(r => r.checkPermissionForUserManager(level) && filterValue.isRecordEnabled(r));
        }

        return this.records.filter(r => filterValue.isRecordEnabled(r));
    }

    isComplete<T extends ObjectWithRecords>(value: T, outdatedTime: number | null = null) {
        // check if everything has been answered already + check out of date
        const records = this.getAllFilteredRecords(value);

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

    isEnabled<T extends ObjectWithRecords>(filterValue: T, ignoreFilter = false) {
        if (!ignoreFilter) {
            if (!this.defaultEnabled) {
                return false;
            }
            if (this.filter && !this.filter.isEnabled(filterValue)) {
                return false;
            }
        }

        if (this.childCategories.length > 0) {
            if (this.filterChildCategories(filterValue).length > 0) {
                return true;
            }
        }

        if (this.filterRecords(filterValue).length > 0) {
            return true;
        }

        return false;
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

    static filterCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T): RecordCategory[] {
        return categories.filter((category) => {
            return category.isEnabled(filterValue);
        });
    }

    filterChildCategories<T extends ObjectWithRecords>(filterValue: T): RecordCategory[] {
        return RecordCategory.filterCategories(this.childCategories, filterValue);
    }

    /**
     * Flatten all categories and child categories into a single array
     */
    static flattenCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T): RecordCategory[] {
        return RecordCategory.filterCategories(
            categories,
            filterValue,
        ).flatMap((cat) => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat);
            cat2.childCategories = [];
            cat2.records = cat2.filterRecords(filterValue);

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategories(cat.childCategories, filterValue).map((c) => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c);
                        cc.name = cat.name + ' → ' + c.name;
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
                        cc.name = cat.name + ' → ' + c.name;
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

    /**
     * Get all categories for the given answers
     */
    static flattenCategoriesForAnswers(categories: RecordCategory[], answers: RecordAnswer[]): RecordCategory[] {
        return this.flattenCategoriesWith(categories, (r) => {
            return !!answers.find(a => a.settings.id == r.id);
        });
    }

    static validate<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T) {
        const filteredCategories = RecordCategory.filterCategories(categories, filterValue);
        const errors = new SimpleErrors();

        // Delete all records that are not in the list
        for (const category of filteredCategories) {
            const requiredCategory = category.isRequired(filterValue);

            for (const record of category.getAllFilteredRecords(filterValue)) {
                try {
                    record.validate(filterValue.getRecordAnswers(), requiredCategory);
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
        }
        errors.throwIfNotEmpty();
    }
}
