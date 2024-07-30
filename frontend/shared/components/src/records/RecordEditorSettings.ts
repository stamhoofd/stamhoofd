import { UIFilterBuilder } from "@stamhoofd/components"
import { ObjectWithRecords, OrganizationRecordsConfiguration, PatchAnswers, RecordCategory } from "@stamhoofd/structures"

export class RecordEditorSettings<T extends ObjectWithRecords> {
    /**
     * Whether the record questions support sensitive data
     */
    dataPermission = false
    toggleDefaultEnabled = false

    exampleValue!: T
    patchExampleValue!: (exampleValue: T, patch: PatchAnswers) => T
    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder

    inheritedRecordsConfiguration: OrganizationRecordsConfiguration|null = null
    
    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options)
    }
}
