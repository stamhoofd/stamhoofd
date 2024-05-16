import { UIFilterBuilder } from "@stamhoofd/components"
import { ObjectWithRecords, RecordAnswer, RecordCategory } from "@stamhoofd/structures"

export class RecordEditorSettings<T extends ObjectWithRecords> {
    dataPermission = false
    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder
    filterValueForAnswers!: (answers: RecordAnswer[]) => T

    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options)
    }
}
