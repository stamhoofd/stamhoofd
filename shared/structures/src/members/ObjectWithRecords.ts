import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"

import { Organization } from "../Organization"
import { Platform } from "../Platform"
import { Member } from "./Member"
import { MemberDetails } from "./MemberDetails"
import { MemberWithRegistrations } from "./MemberWithRegistrations"
import { MembersBlob } from "./MemberWithRegistrationsBlob"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

export interface ObjectWithRecords {
    isRecordCategoryEnabled(recordCategory: RecordCategory): boolean
    isRecordEnabled(record: RecordSettings): boolean
    getAllRecordCategories(): RecordCategory[]
    getRecords(): RecordAnswer[]
    patchRecords(patch: PatchableArrayAutoEncoder<RecordAnswer>)
}
