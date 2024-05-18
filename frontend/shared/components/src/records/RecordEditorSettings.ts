import { UIFilterBuilder } from "@stamhoofd/components"
import { ObjectWithRecords, RecordAnswer, RecordCategory } from "@stamhoofd/structures"

export class RecordEditorSettings<T extends ObjectWithRecords> {
    /**
     * Whether the record questions support sensitive data
     */
    dataPermission = false

    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder
    
    filterValueForAnswers!: (answers: RecordAnswer[]) => T

    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options)
    }
}
