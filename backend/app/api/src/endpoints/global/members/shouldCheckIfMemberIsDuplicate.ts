import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { MemberDetails, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

export function shouldCheckIfMemberIsDuplicateForPatch(patch: { details: MemberDetails | AutoEncoderPatchType<MemberDetails> | undefined }, originalDetails: MemberDetails): boolean {
    if (patch.details === undefined) {
        return false;
    }

    return (
    // has long first name
        ((patch.details.firstName !== undefined && patch.details.firstName.length > 3) || (patch.details.firstName === undefined && originalDetails.firstName.length > 3))
        // or has long last name
        || ((patch.details.lastName !== undefined && patch.details.lastName.length > 3) || (patch.details.lastName === undefined && originalDetails.lastName.length > 3))
    )
    // has name change or birthday change
    && (
    // has first name change
        (patch.details.firstName !== undefined && patch.details.firstName !== originalDetails.firstName)
        // has last name change
        || (patch.details.lastName !== undefined && patch.details.lastName !== originalDetails.lastName)
        // has birth day change
        || (patch.details.birthDay !== undefined && patch.details.birthDay?.getTime() !== originalDetails.birthDay?.getTime())
    );
}

export function shouldCheckIfMemberIsDuplicateForPut(put: MemberWithRegistrationsBlob): boolean {
    if (put.details.firstName.length <= 3 && put.details.lastName.length <= 3) {
        return false;
    }

    const age = put.details.age;
    // do not check if member is duplicate for historical members
    return age !== null && age < 81;
}
