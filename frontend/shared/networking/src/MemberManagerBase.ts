import { PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { MemberWithRegistrations, MemberWithRegistrationsBlob } from "@stamhoofd/structures";

export class MemberManagerBase {

    /// Prepare a patch of updated members
    getDetailsOverridePatch(members: MemberWithRegistrations[]): PatchableArrayAutoEncoder<MemberWithRegistrationsBlob> {
        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>

        for (const member of members) {
            // Clean the member details
            member.details.cleanData()

            const memberPatch = MemberWithRegistrationsBlob.patch({ id: member.id })
            memberPatch.details = member.details

            patch.addPatch(memberPatch)
        }
        return patch
    }
}
