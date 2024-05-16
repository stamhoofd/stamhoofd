import { AutoEncoderPatchType, PatchableArrayAutoEncoder,PatchMap } from "@simonbackx/simple-encoding"

import { RecordAnswer } from "./records/RecordAnswer"
import { Filterable, RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

export type PatchAnswers = PatchMap<string, RecordAnswer|AutoEncoderPatchType<RecordAnswer>|null>

export interface ObjectWithRecords extends Filterable {
    isRecordCategoryEnabled(recordCategory: RecordCategory): boolean
    isRecordEnabled(record: RecordSettings): boolean
    getRecordAnswers(): Map<string, RecordAnswer>
    patchRecordAnswers(patch: PatchAnswers): this
}
