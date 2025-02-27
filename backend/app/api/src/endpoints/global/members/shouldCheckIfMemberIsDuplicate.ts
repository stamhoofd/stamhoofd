import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { MemberDetails, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

/**
 * Returns true when either the firstname, lastname or birthday has changed
 */
export function shouldCheckIfMemberIsDuplicateForPatch(patch: { details: MemberDetails | AutoEncoderPatchType<MemberDetails> | undefined }, originalDetails: MemberDetails): boolean {
    if (patch.details === undefined) {
        return false;
    }

    // name or birthday has changed
    if (
        (patch.details.firstName !== undefined && patch.details.firstName !== originalDetails.firstName)
        || (patch.details.lastName !== undefined && patch.details.lastName !== originalDetails.lastName)
        || (patch.details.birthDay !== undefined && patch.details.birthDay !== originalDetails.birthDay)
    ) {
        return true;
    }

    return false;
}
