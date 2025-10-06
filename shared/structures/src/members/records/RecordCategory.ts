import { ArrayDecoder, AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { StringCompare } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from "../../filters/ChoicesFilter";
import { DateFilterDefinition } from "../../filters/DateFilter";
import { FilterDefinition } from "../../filters/FilterDefinition";
import { NumberFilterDefinition } from "../../filters/NumberFilter";
import { PropertyFilter } from "../../filters/PropertyFilter";
import { StringFilterDefinition } from "../../filters/StringFilter";
import { RecordAnswer, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordDateAnswer, RecordMultipleChoiceAnswer, RecordPriceAnswer, RecordTextAnswer } from "./RecordAnswer";
import { RecordChoice, RecordSettings, RecordType } from "./RecordSettings";

export class RecordEditorSettings<T> {
    dataPermission = false
    filterDefinitions: (categories: RecordCategory[]) => FilterDefinition<T>[]
    filterValueForAnswers: (answers: RecordAnswer[]) => T

    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options)
    }
}

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
            return [...this.records, ...this.childCategories.flatMap(c => c.getAllRecords())];
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

    isEnabled<T>(filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean) {
        if (this.filter && !this.filter.enabledWhen.decode(filterDefinitions).doesMatch(filterValue)) {
            return false
        }

        if (this.childCategories.length > 0) {
            if (this.filterChildCategories(filterValue, filterDefinitions, dataPermission).length > 0) {
                return true;
            }
        }

        if (this.filterRecords(dataPermission).length > 0) {
            return true
        }

        return false
    }

    isRequired<T>(filterValue: T, filterDefinitions: FilterDefinition<T>[]) {
        if (!this.filter) {
            return false;
        }
        if (this.filter.requiredWhen === null) {
            // Always skippable
            return false;
        }

        const decoded = this.filter.requiredWhen?.decode(filterDefinitions)

        if (!decoded) {
            // Failed to decode
            return true;
        }

        if (decoded.doesMatch(filterValue)) {
            return true;
        }
        return false;
    }

    static filterCategories<T>(categories: RecordCategory[], filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean): RecordCategory[] {
        return categories.filter(category => {
            return category.isEnabled(filterValue, filterDefinitions, dataPermission)
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
             // Make a (not deep!) clone
            const cat2 = RecordCategory.create(cat)
            cat2.childCategories = []
            cat2.records = cat2.filterRecords(dataPermission)

            if (cat.childCategories.length > 0) {
                // Make a (not deep!) clone
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

    static getRecordCategoryDefinitions<T>(recordCategories: RecordCategory[], getAnswers: (value: T) => RecordAnswer[]): FilterDefinition<T>[] {
        const definitions: FilterDefinition<T>[] = []

        for (const recordCategory of recordCategories) {
            for (const record of recordCategory.records) {
                definitions.push(...this.filterDefinitionsFromRecord(record, recordCategory.name, getAnswers))
            }

            for (const category of recordCategory.childCategories) {
                for (const record of category.getAllRecords()) {
                    definitions.push(...this.filterDefinitionsFromRecord(record, recordCategory.name + ' → ' + category.name, getAnswers))
                }
            }
        }

        return definitions
    }

    static filterDefinitionsFromRecord<T>(record: RecordSettings, category: string, getAnswers: (value: T) => RecordAnswer[]): FilterDefinition<T>[] {
        if (record.type === RecordType.Checkbox) {
            return [
                new ChoicesFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    category,
                    choices: [
                        new ChoicesFilterChoice("checked", "Aangevinkt"),
                        new ChoicesFilterChoice("not_checked", "Niet aangevinkt")
                    ], 
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id)
                        if (answer instanceof RecordCheckboxAnswer) {
                            return answer?.selected ? ["checked"] : ["not_checked"]
                        }
                        return ["not_checked"]
                    },
                    defaultMode: ChoicesFilterMode.Or
                })
            ]
        }

        if (record.type === RecordType.MultipleChoice) {
            return [
                new ChoicesFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    category,
                    choices: record.choices.map(c => new ChoicesFilterChoice(c.id, c.name)), 
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id) 
                        let choices: RecordChoice[] = []

                        if (!answer || !(answer instanceof RecordMultipleChoiceAnswer)) {

                            if (answer && (answer instanceof RecordChooseOneAnswer) && answer.selectedChoice) {
                                choices = [answer.selectedChoice]
                            }
                        } else {
                            choices = answer.selectedChoices
                        }

                        // Map choices to valid choices on id or name
                        return choices.map(c => {
                            const choice = record.choices.find(ch => ch.id === c.id) ?? record.choices.find(ch => StringCompare.typoCount(ch.name, c.name) === 0) ?? record.choices.find(ch => StringCompare.typoCount(ch.name, c.name) < 2)
                            if (choice) {
                                return choice.id
                            }
                            return c.id
                        })
                    },
                    defaultMode: ChoicesFilterMode.And
                })
            ]
        }

        if (record.type === RecordType.ChooseOne) {
            return [
                new ChoicesFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    category,
                    choices: record.choices.map(c => new ChoicesFilterChoice(c.id, c.name)), 
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id) 
                        let choices: RecordChoice[] = []

                        if (!answer || !(answer instanceof RecordChooseOneAnswer) || !answer.selectedChoice) {
                            if (answer && (answer instanceof RecordMultipleChoiceAnswer)) {
                                choices = answer.selectedChoices
                            }
                        } else {
                            choices = [answer.selectedChoice]
                        }

                        // Map choices to valid choices on id or name
                        return choices.map(c => {
                            const choice = record.choices.find(ch => ch.id === c.id) ?? record.choices.find(ch => StringCompare.typoCount(ch.name, c.name) === 0) ?? record.choices.find(ch => StringCompare.typoCount(ch.name, c.name) < 2)
                            if (choice) {
                                return choice.id
                            }
                            return c.id
                        })
                    },
                    defaultMode: ChoicesFilterMode.Or
                })
            ]
        }

        if (record.type === RecordType.Text || record.type === RecordType.Textarea) {
            return [
                new StringFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    category,
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id) 
                        if (answer instanceof RecordTextAnswer) {
                            return answer?.value ?? ""
                        }
                        return answer?.stringValue ?? "";
                    }
                })
            ]
        }

        if (record.type === RecordType.Price) {
            return [
                new NumberFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    currency: true,
                    floatingPoint: true,
                    category,
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id)
                        if (answer instanceof RecordPriceAnswer) {
                            return answer.value ?? 0
                        }

                        if (typeof answer?.objectValue === "number" && !isNaN(answer.objectValue)) {
                            return answer.objectValue
                        }
                        return 0
                    }
                })
            ]
        }

        if (record.type === RecordType.Date) {
            return [
                new DateFilterDefinition<T>({
                    id: "record_"+record.id, 
                    name: record.name, 
                    time: false,
                    category,
                    getValue: (v) => {
                        const answers = getAnswers(v)
                        const answer = answers.find(a => a.settings?.id === record.id)
                        if (answer instanceof RecordDateAnswer) {
                            return answer.dateValue ?? new Date(1900)
                        }
                        return new Date(1900)
                    }
                })
            ]
        }
        return []
    }

    static validate<T>(categories: RecordCategory[], answers: RecordAnswer[], filterValue: T, filterDefinitions: FilterDefinition<T>[], dataPermission: boolean) {
        const filteredCategories = RecordCategory.filterCategories(categories, filterValue, filterDefinitions, dataPermission)
        const errors = new SimpleErrors();
        const cleanedAnswers: RecordAnswer[] = []

        // Delete all records that are not in the list
        for (const category of filteredCategories) {
            const requiredCategory = category.isRequired(filterValue, filterDefinitions);

            for (const record of category.getAllFilteredRecords(filterValue, filterDefinitions, dataPermission)) {
                try {
                    const answer = record.validate(answers, requiredCategory)
                    if (answer && !cleanedAnswers.includes(answer)) {
                        cleanedAnswers.push(answer)
                    }
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
        return cleanedAnswers;
    }
}