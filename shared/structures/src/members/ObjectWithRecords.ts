import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"

import { Organization } from "../Organization"
import { Platform } from "../Platform"
import { OldRegisterCart } from "./checkout/OldRegisterCart"
import { Member } from "./Member"
import { MemberDetails } from "./MemberDetails"
import { MemberWithRegistrations } from "./MemberWithRegistrations"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

interface ObjectWithRecords {
    isRecordCategoryEnabled(recordCategory: RecordCategory): boolean
    isRecordEnabled(record: RecordSettings): boolean
    getAllRecordCategories(): RecordCategory[]
    getRecords(): RecordAnswer[]
    patchRecords(patch: PatchableArrayAutoEncoder<RecordAnswer>)
}



export class MemberCheckout implements ObjectWithRecords{
    member: MemberWithRegistrations
    patch: AutoEncoderPatchType<Member>
    platform?: Platform
    cart: OldRegisterCart

    constructor(data: {member: MemberWithRegistrations}) {
        this.member = data.member
        this.patch = Member.patch({id: this.member.id})
    }

    get patchedMember() {
        return this.member.patch(this.patch)
    }

    isRecordCategoryEnabled(recordCategory: RecordCategory): boolean {
        return false;
    }

    isRecordEnabled(record: RecordSettings): boolean {
        if (record.sensitive && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }
        return true;
    }

    getAllRecordCategories(): RecordCategory[] {
        return []
    }

    getRecords(): RecordAnswer[] {
        return this.patchedMember.details.recordAnswers
    }

    patchRecords(patch: PatchableArrayAutoEncoder<RecordAnswer>) {
        this.patch = this.patch.patch({
            details: MemberDetails.patch({
                recordAnswers: patch
            })
        })
    }
}
