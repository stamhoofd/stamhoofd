import { ArrayDecoder, AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { FilterDefinition } from "../../filters/FilterDefinition";
import { PropertyFilter } from "../../filters/PropertyFilter";
import { RecordSettings } from "./RecordSettings";

export class RecordCategory extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    /**
     * A category can either have childCategories or records, but never both. Records are ignored as soon as the category has at least one child category.
     * Currently we only support 2 categories deep
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    childCategories: RecordCategory[] = []

    @field({ decoder: new ArrayDecoder(RecordSettings) })
    records: RecordSettings[] = []

    @field({ decoder: PropertyFilter, version: 126, nullable: true })
    filter: PropertyFilter<any> | null = null

    getAllRecords(): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [...this.childCategories.flatMap(c => c.getAllRecords()), ...this.records]
        }
        return this.records
    }

    getAllFilteredRecords<T>(filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean): RecordSettings[] {
        if (this.childCategories.length > 0) {
            return [
                ...this.filterChildCategories(filterValue, filterDefinitions, dataPermission).flatMap(c => c.getAllFilteredRecords(filterValue, filterDefinitions, dataPermission)),
                ...this.filterRecords(dataPermission)
            ]
        }
        return this.filterRecords(dataPermission)
    }

    filterRecords(dataPermission: boolean) {
        if (dataPermission) {
            return this.records
        }
        return this.records.filter(r => !r.sensitive)
    }

    static filterCategories<T>(categories: RecordCategory[], filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean): RecordCategory[] {
        return categories.filter(category => {
            if (category.filter && !category.filter.enabledWhen.decode(filterDefinitions).doesMatch(filterValue)) {
                return false
            }

            if (category.childCategories.length > 0) {
                if (category.filterChildCategories(filterValue, filterDefinitions, dataPermission).length > 0) {
                    return true;
                }
            }

            if (category.filterRecords(dataPermission).length > 0) {
                return true
            }

            return false
        })
    }

    filterChildCategories<T>(filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean): RecordCategory[] {
        return RecordCategory.filterCategories(this.childCategories, filterValue, filterDefinitions, dataPermission)
    }

    /**
     * Flatten all categories and child categories into a single array
     */
    static flattenCategories<T>(categories: RecordCategory[], filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean): RecordCategory[] {
        return RecordCategory.filterCategories(
            categories,
            filterValue,
            filterDefinitions,
            dataPermission
        ).flatMap(cat => {
            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
                const cat2 = RecordCategory.create(cat)
                cat2.childCategories = []
                return [
                    ...(cat2.records.length > 0 ? [cat2] : []),
                    ...this.flattenCategories(cat.childCategories, filterValue, filterDefinitions, dataPermission).map(c => {
                        // Make a (not deep!) clone
                        const cc = RecordCategory.create(c)
                        cc.name = cat.name + " → " + c.name
                        return cc
                    })
                ]
            }
            return [cat]
        })
    }
}