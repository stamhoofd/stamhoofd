

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
    members: DecryptedMember[] | null = null

    async setMembers(data: KeychainedResponse<EncryptedMemberWithRegistrations[]>) {
        // Save keychain items
        Keychain.addItems(data.keychainItems)

        Vue.set(this, "members", [])

        for (const member of data.data) {
            const keychainItem = Keychain.getItem(member.publicKey)

            let decryptedDetails: MemberDetails | undefined
            if (!keychainItem) {
                console.warn("Missing keychain item for member " + member.id)
            } else {
                if (!member.encryptedForMember) {
                    console.warn("encryptedForMember not set for member " + member.id)
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
                        console.error("Failed to read member data for " + member.id)
                    }
                }

            }

            console.log(member)

            const decryptedMember = DecryptedMember.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey,
                registrations: member.registrations
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
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })
        await this.setMembers(response.data)
    }

    async addMember(member: MemberDetails) {
        const session = SessionManager.currentSession!

        // Create a keypair
        const keyPair = await Sodium.generateEncryptionKeyPair()
        const keychainItem = await session.createKeychainItem(keyPair)

        // Create member
        const decryptedMember = DecryptedMember.create({
            details: member,
            publicKey: keyPair.publicKey,
            registrations: []
        })

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/user/members",
            body: PatchMembers.create({
                addMembers: await this.getEncryptedMembers([decryptedMember]),
                updateMembers: this.members ? await this.getEncryptedMembers(this.members) : [],
                keychainItems: [keychainItem]
            }),
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })

        await MemberManager.setMembers(response.data)
    }

    async getEncryptedMembers(members: DecryptedMember[]): Promise<EncryptedMember[]> {
        const encryptedMembers: EncryptedMember[] = [];

        for (const member of members) {
            if (!member.details) {
                throw new Error("Can't save member with undefined details!")
            }
            const data = JSON.stringify(new VersionBox(member.details).encode({ version: Version }))

            encryptedMembers.push(
                EncryptedMember.create({
                    id: member.id,
                    encryptedForOrganization: await Sodium.sealMessage(data, OrganizationManager.organization.publicKey),
                    encryptedForMember: await Sodium.sealMessage(data, member.publicKey),
                    publicKey: member.publicKey
                })
            )
        }
        return encryptedMembers
    }

    async patchMembers(members: DecryptedMember[]) {

        const encryptedMembers = await this.getEncryptedMembers(members)

        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/user/members",
            body: PatchMembers.create({
                addMembers: [],
                updateMembers: encryptedMembers,
                keychainItems: []
            }),
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })
        this.setMembers(response.data)
    }

    /**
     * List all unique parents of the already existing members
     */
    getParents(): Parent[] {
        if (!this.members) {
            return []
        }
        const parents = new Map<string, Parent>()
        for (const member of this.members) {
            if (!member.details) {
                continue
            }
            for (const parent of member.details.parents) {
                parents.set(parent.id, parent)
            }
        }

        return Array.from(parents.values())
    }

    updateAddress(oldValue: Address, newValue: Address) {
        if (!this.members) {
            return
        }

        const str = oldValue.toString()
        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            if (member.details.address && member.details.address.toString() == str) {
                member.details.address = newValue
            }

            for (const parent of member.details.parents) {
                if (parent.address && parent.address.toString() == str) {
                    parent.address = newValue
                }
            }
        }
    }

    /**
     * List all unique addresses of the already existing members
     */
    getAddresses(): Address[] {
        if (!this.members) {
            return []
        }
        const addresses = new Map<string, Address>()
        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            if (member.details.address) {
                addresses.set(member.details.address.toString(), member.details.address)
            }

            for (const parent of member.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address)
                }
            }
        }

        return Array.from(addresses.values())
    }

}

export const MemberManager = new MemberManagerStatic()