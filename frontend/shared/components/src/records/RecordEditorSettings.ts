import { UIFilterBuilder } from "@stamhoofd/components"
import { ObjectWithRecords, PatchAnswers, RecordCategory } from "@stamhoofd/structures"

export class RecordEditorSettings<T extends ObjectWithRecords> {
    /**
     * Whether the record questions support sensitive data
     */
    dataPermission = false

    exampleValue!: T
    patchExampleValue!: (exampleValue: T, patch: PatchAnswers) => T
    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder
    
    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options)
    }
}
