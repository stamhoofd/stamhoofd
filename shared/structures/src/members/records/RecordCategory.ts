import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleErrors } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from "../../filters/ChoicesFilter";
import { DateFilterDefinition } from "../../filters/DateFilter";
import { FilterDefinition } from "../../filters/FilterDefinition";
import { StamhoofdFilter } from "../../filters/new/StamhoofdFilter";
import { NumberFilterDefinition } from "../../filters/NumberFilter";
import { PropertyFilter } from "../../filters/PropertyFilter";
import { StringFilterDefinition } from "../../filters/StringFilter";
import { ObjectWithRecords } from "../ObjectWithRecords";
import { RecordAnswer, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordDateAnswer, RecordMultipleChoiceAnswer, RecordPriceAnswer, RecordTextAnswer } from "./RecordAnswer";
import { RecordSettings, RecordType } from "./RecordSettings";

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean
}

export class RecordCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    /**
     * Sometimes a category needs to be in the list but not enabled.
     * E.g. when decendants can enable it optionally and share the data
     */
    @field({ decoder: BooleanDecoder, version: 255 })
    defaultEnabled = true

    /**
     * A category can either have childCategories or records, but never both. Records are ignored as soon as the category has at least one child category.
     * Currently we only support 2 categories deep
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    childCategories: RecordCategory[] = []

    @field({ decoder: new ArrayDecoder(RecordSettings) })
    records: RecordSettings[] = []

    @field({ decoder: PropertyFilter, version: 126, nullable: true, optional: true })
    filter: PropertyFilter | null = null

    getAllRecords(): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [...this.childCategories.flatMap(c => c.getAllRecords()), ...this.records]
        }
        return this.records
    }

    getAllFilteredRecords<T extends ObjectWithRecords>(filterValue: T): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [
                ...this.filterChildCategories(filterValue).flatMap(c => c.getAllFilteredRecords(filterValue)),
                ...this.filterRecords(filterValue)
            ]
        }
        return this.filterRecords(filterValue)
    }

    filterRecords<T extends ObjectWithRecords>(filterValue: T) {
        return this.records.filter(r => filterValue.isRecordEnabled(r))
    }

    isEnabled<T extends ObjectWithRecords>(filterValue: T) {
        if (this.filter && this.filter.isEnabled(filterValue)) {
            return false
        }

        if (this.childCategories.length > 0) {
            if (this.filterChildCategories(filterValue).length > 0) {
                return true;
            }
        }

        if (this.filterRecords(filterValue).length > 0) {
            return true
        }

        return false
    }

    static filterCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T): RecordCategory[] {
        return categories.filter(category => {
            return category.isEnabled(filterValue)
        })
    }

    filterChildCategories<T extends ObjectWithRecords>(filterValue: T): RecordCategory[] {
        return RecordCategory.filterCategories(this.childCategories, filterValue)
    }

    /**
     * Flatten all categories and child categories into a single array
     */
    static flattenCategories<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T): RecordCategory[] {
        return RecordCategory.filterCategories(
            categories,
            filterValue
        ).flatMap(cat => {
             // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat)
            cat2.childCategories = []
            cat2.records = cat2.filterRecords(filterValue)

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategories(cat.childCategories, filterValue).map(c => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c)
                        cc.name = cat.name + " → " + c.name
                        return cc
                    })
                ]
            }
            return (cat2.records.length > 0 ? [cat2] : [])
        })
    }

    /**
     * Get a flat array with record categories whose records match the filter
     */
    static flattenCategoriesWith(categories: RecordCategory[], filter: (record: RecordSettings) => boolean): RecordCategory[] {
        return categories.flatMap(cat => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat)

            const updatedRecords = cat.records.filter(r => {
                return filter(r)
            });

            cat2.records = updatedRecords

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                cat2.childCategories = []
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategoriesWith(cat.childCategories, filter).map(c => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c)
                        cc.name = cat.name + " → " + c.name
                        return cc
                    })
                ]
            }
            return cat2.records.length > 0 ? [cat2] : []
        })
    }

    /**
     * Remove (child) categories that don't have a record that matches the filter
     */
    static filterRecordsWith(categories: RecordCategory[], filter: (record: RecordSettings) => boolean): RecordCategory[] {
        return categories.flatMap(cat => {
            // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat)

            const updatedRecords = cat.records.filter(r => {
                return filter(r)
            });

            cat2.records = updatedRecords
            cat2.childCategories = this.filterRecordsWith(cat.childCategories, filter)
            return cat2.records.length > 0 || cat2.childCategories.length > 0 ? [cat2] : []
        })
    }

    /**
     * Get all categories for the given answers
     */
    static flattenCategoriesForAnswers(categories: RecordCategory[], answers: RecordAnswer[]): RecordCategory[] {
        return this.flattenCategoriesWith(categories, r => {
            return !!answers.find(a => a.settings.id == r.id)
        });
    }

    static validate<T extends ObjectWithRecords>(categories: RecordCategory[], filterValue: T) {
        const filteredCategories = RecordCategory.filterCategories(categories, filterValue)
        const allRecords = filteredCategories.flatMap(c => c.getAllFilteredRecords(filterValue))
        const errors = new SimpleErrors()

        // Delete all records that are not in the list
        for (const record of allRecords) {
            try {
                record.validate(filterValue.getRecordAnswers())
            } catch (e) {
                if (isSimpleErrors(e) || isSimpleError(e)) {
                    errors.addError(e)
                } else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty()
    }
}
