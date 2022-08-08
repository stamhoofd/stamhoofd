import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Group, KeychainedMembers, Member, MemberWithRegistrations, RegistrationWithEncryptedMember, RegistrationWithMember } from "@stamhoofd/structures";

export class MemberManagerBase {
    /**
     * @deprecated
     */
    decryptMember(member: Member): Member {
        return member;
    }

    decryptRegistrationWithMember(registration: RegistrationWithEncryptedMember, groups: Group[]): RegistrationWithMember {
        const member = registration.member

        const decryptedRegistration = RegistrationWithMember.create(Object.assign({}, registration, {
            member,
            group: groups.find(g => g.id === registration.groupId)
        }))

        return decryptedRegistration
    }

    decryptRegistrationsWithMember(data: RegistrationWithEncryptedMember[], groups: Group[]): RegistrationWithMember[] {
        const registrations: RegistrationWithMember[] = []

        for (const registration of data) {
            registrations.push(this.decryptRegistrationWithMember(registration, groups))
        }
        return registrations
    }

    /// Prepare a patch of updated members
    getEncryptedMembers(members: MemberWithRegistrations[]): AutoEncoderPatchType<KeychainedMembers> {
        const patch = KeychainedMembers.patch({})

        for (const member of members) {
            // Clean the member details
            member.details.cleanData()

            const memberPatch = Member.patch({ id: member.id })
            memberPatch.details = member.details

            patch.members.addPatch(memberPatch)
        }
        return patch
    }
}