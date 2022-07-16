import { AutoEncoderPatchType } from "@simonbackx/simple-encoding"
import { EncryptedMember, Group, KeychainedMembers, Member, MemberWithRegistrations, Organization, RegistrationWithEncryptedMember, RegistrationWithMember } from "@stamhoofd/structures"

export class MemberManagerBase {
    decryptMember(member: EncryptedMember, organization: Organization): Member {
        if (member.nonEncryptedDetails) {
            const details = member.nonEncryptedDetails
            return Member.create({ ...member, details })
        }

        // This can get removed and should trigger atm
        throw new Error('Found a member that was missing the now required nonEncryptedDetails property');
    }

    decryptRegistrationWithMember(registration: RegistrationWithEncryptedMember, groups: Group[], organization: Organization): RegistrationWithMember {
        const member = registration.member
        const decryptedMember = this.decryptMember(member, organization)

        const decryptedRegistration = RegistrationWithMember.create(Object.assign({}, registration, {
            member: decryptedMember,
            group: groups.find(g => g.id === registration.groupId)
        }))

        return decryptedRegistration
    }

    decryptRegistrationsWithMember(data: RegistrationWithEncryptedMember[], groups: Group[], organization: Organization): RegistrationWithMember[] {
        const registrations: RegistrationWithMember[] = []

        for (const registration of data) {
            registrations.push(this.decryptRegistrationWithMember(registration, groups, organization))
        }

        return registrations
    }

    /// Prepare a patch of updated members
    getEncryptedMembers(members: MemberWithRegistrations[]): AutoEncoderPatchType<KeychainedMembers> {
        const patch = KeychainedMembers.patch({})

        for (const member of members) {
            // Clean the member details
            member.details.cleanData()

            const memberPatch = EncryptedMember.patch({ id: member.id })
            memberPatch.firstName = member.details.firstName
            memberPatch.nonEncryptedDetails = member.details

            patch.members.addPatch(memberPatch)
        }
        return patch
    }
}