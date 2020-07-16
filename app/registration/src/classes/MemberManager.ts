

import { ArrayDecoder,Decoder, ObjectData, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto'
import { Keychain, SessionManager } from '@stamhoofd/networking'
import { DecryptedMember,EncryptedMember,EncryptedMemberWithRegistrations,KeychainedResponse, KeychainedResponseDecoder,MemberDetails, Version } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator";

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic {
    members: DecryptedMember[] | null = null

    async setMembers(data: KeychainedResponse<EncryptedMemberWithRegistrations[]>) {
        // Save keychain items
        Keychain.addItems(data.keychainItems)

        Vue.set(this, "members", [])

        for (const member of data.data) {
            const keychainItem = Keychain.getItem(member.publicKey)

            let decryptedDetails: MemberDetails | undefined
            if (!keychainItem) {
                console.warn("Missing keychain item for member "+member.id)
            } else {
                if (!member.encryptedForMember) {
                    console.warn("encryptedForMember not set for member "+member.id)
                } else {
                    try {
                        const session = SessionManager.currentSession!
                        const keyPair = await session.decryptKeychainItem(keychainItem)
                        const json = await Sodium.unsealMessage(member.encryptedForMember, keyPair.publicKey, keyPair.privateKey)
                        const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
                        decryptedDetails = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>)).data
                        console.log(decryptedDetails)
                    } catch (e) {
                        console.error(e)
                        console.error("Failed to read member data for "+member.id)
                    }
                }
                
            }

            const decryptedMember = DecryptedMember.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey
            })
            console.log(decryptedMember)
            this.members!.push(decryptedMember)
        }
    }

    async loadMembers() {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/user/members",
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMember as Decoder<EncryptedMemberWithRegistrations>))
        })
        await this.setMembers(response.data)
    }

}

export const MemberManager = new MemberManagerStatic()