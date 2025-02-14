import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';

import { RecordAnswer } from './records/RecordAnswer.js';
import { Filterable } from './records/RecordCategory.js';
import { RecordSettings } from './records/RecordSettings.js';

export type PatchAnswers = PatchMap<string, RecordAnswer | AutoEncoderPatchType<RecordAnswer> | null>;

export interface ObjectWithRecords extends Filterable {
    isRecordEnabled(record: RecordSettings): boolean;
    getRecordAnswers(): Map<string, RecordAnswer>;
    patchRecordAnswers(patch: PatchAnswers): this;
}
