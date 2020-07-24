

import { ArrayDecoder, Decoder, ObjectData, VersionBoxDecoder, VersionBox } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto'
import { Keychain, SessionManager } from '@stamhoofd/networking'
import { DecryptedMember, EncryptedMember, EncryptedMemberWithRegistrations, KeychainedResponse, KeychainedResponseDecoder, MemberDetails, Version, PatchMembers, Parent, Address } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator";
import { OrganizationManager } from './OrganizationManager';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic {
    async decryptMembers(data: EncryptedMemberWithRegistrations[]) {
        // Save keychain items
        const members: DecryptedMember[] = []
        const groups = OrganizationManager.organization.groups
        const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)

        if (!keychainItem) {
            throw new Error("Missing organization keychain")
        }

        const session = SessionManager.currentSession!
        const keyPair = await session.decryptKeychainItem(keychainItem)

        for (const member of data) {

            let decryptedDetails: MemberDetails | undefined

            if (!member.encryptedForOrganization) {
                console.warn("encryptedForOrganization not set for member " + member.id)
            } else {
                try {
                    const json = await Sodium.unsealMessage(member.encryptedForOrganization, keyPair.publicKey, keyPair.privateKey)
                    const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
                    decryptedDetails = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>)).data
                    console.log(decryptedDetails)
                } catch (e) {
                    console.error(e)
                    console.error("Failed to read member data for " + member.id)
                }
            }

            const decryptedMember = DecryptedMember.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey,
                registrations: member.registrations
            })

            decryptedMember.fillGroups(groups)
            members.push(decryptedMember)
        }

        return members;
    }

    async loadMembers(groupId: string | null = null) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/group/" + groupId + "/members",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })
        return await this.decryptMembers(response.data)
    }
}

export const MemberManager = new MemberManagerStatic()