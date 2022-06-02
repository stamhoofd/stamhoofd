import { AutoEncoderPatchType, Decoder,ObjectData, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { Sodium } from "@stamhoofd/crypto"
import { EncryptedMember, EncryptedMemberDetails, Group, KeychainedMembers, Member,MemberDetails, MemberDetailsMeta, MemberWithRegistrations, Organization, RegistrationWithEncryptedMember, RegistrationWithMember, Version } from "@stamhoofd/structures"
import { Sorter } from "@stamhoofd/utility"

import { Keychain } from "./Keychain"
import { SessionManager } from "./SessionManager"

export class MemberManagerBase {
    private async getKeyPair(encrypted: EncryptedMemberDetails, organization: Organization) {
        if (encrypted.publicKey === organization.publicKey && organization.privateMeta?.privateKey) {
            // We can use the stored key
            const keyPair = {
                publicKey: organization.publicKey,
                privateKey: organization.privateMeta.privateKey
            }
            return keyPair
        }
        const keychainItem = Keychain.getItem(encrypted.publicKey)

        if (!keychainItem) {
            throw new Error("Keychain item missing for this member")
        }
        const session = SessionManager.currentSession!
        return await session.decryptKeychainItem(keychainItem)
    }
    async decryptMemberDetails(encrypted: EncryptedMemberDetails, organization: Organization): Promise<MemberDetails> {
        const keyPair = await this.getKeyPair(encrypted, organization)
        const json = await Sodium.unsealMessage(encrypted.ciphertext, keyPair.publicKey, keyPair.privateKey)
        const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
        const decoded = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>))
        const details = decoded.data
        const version = data.field("version").integer

        if (version < 128) {
            details.upgradeFromLegacy(organization.meta)
        }

        return details
    }

    async decryptMember(member: EncryptedMember, organization: Organization): Promise<Member> {
        if (member.nonEncryptedDetails) {
            const details = member.nonEncryptedDetails
            return Member.create({ ...member, details })
        }

        // Get the newest complete blob where we have a key for
        const oldToNew = member.encryptedDetails.sort((a, b) => Sorter.byDateValue(b.meta.date, a.meta.date))

        let latest: MemberDetails | null = null
        let latestEncryptedDetails: EncryptedMemberDetails | null = null
        for (const encryptedDetails of oldToNew.slice().reverse()) {
            if (!encryptedDetails.meta.isRecovered) {
                // Do we have a key?
                if ((Keychain.hasItem(encryptedDetails.publicKey) || (organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey)) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        latest = await this.decryptMemberDetails(encryptedDetails, organization)
                        latestEncryptedDetails = encryptedDetails
                        break
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)
                    }
                }
            }
        }

        if (!latest) {
            // We don't have complete data.
            // Use the oldest available recovered blob and keep applying all the updates
            for (const encryptedDetails of oldToNew) {
                // Do we have a key?
                if ((Keychain.hasItem(encryptedDetails.publicKey) || (organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey)) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        latest = await this.decryptMemberDetails(encryptedDetails, organization)
                        latestEncryptedDetails = encryptedDetails

                        // We need the oldest
                        break
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)
                    }
                } else {
                    // Does it have public data?
                    if (encryptedDetails.publicData) {
                        latest = encryptedDetails.publicData
                        latestEncryptedDetails = encryptedDetails

                        if (!latest.firstName) {
                            // Autofill name
                            latest.firstName = member.firstName
                        }
                        break
                    }
                }
            }
        }

        if (!latest || !latestEncryptedDetails) {
            // todo: return placeholder
            const details = new MemberDetails()
            details.firstName = member.firstName

            // Mark as recovered details (prevents us from deleting the old encrypted blobs)
            details.isRecovered = true
            return Member.create({ ...member, details })
        }

        const details = latest

        // Apply newer (incomplete blobs)
        // From old to new
        for (const encryptedDetails of oldToNew) {
            if (encryptedDetails.id !== latestEncryptedDetails.id && encryptedDetails.meta.isRecovered && latestEncryptedDetails.meta.date < encryptedDetails.meta.date) {
                if ((Keychain.hasItem(encryptedDetails.publicKey) || (organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey)) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        const updates = await this.decryptMemberDetails(encryptedDetails, organization)
                        details.merge(updates)
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)

                        if (encryptedDetails.publicData) {
                            // Merge the non-encrypted blob of data
                            details.merge(encryptedDetails.publicData)
                        }
                    }
                } else {
                    if (encryptedDetails.publicData) {
                        // Merge the non-encrypted blob of data
                        details.merge(encryptedDetails.publicData)
                    }
                }
            }
        }


        const mm = Member.create({ ...member, details })
        const meta = mm.getDetailsMeta()

        // Check if meta is wrong
        if (!meta || !meta.isAccurateFor(details)) {
            console.warn("Found inaccurate meta data!")
        }

        return mm
    }

    async decryptRegistrationWithMember(registration: RegistrationWithEncryptedMember, groups: Group[], organization: Organization): Promise<RegistrationWithMember> {
        const member = registration.member
        const decryptedMember = await this.decryptMember(member, organization)

        const decryptedRegistration = RegistrationWithMember.create(Object.assign({}, registration, {
            member: decryptedMember,
            group: groups.find(g => g.id === registration.groupId)
        }))

        return decryptedRegistration
    }

    async decryptRegistrationsWithMember(data: RegistrationWithEncryptedMember[], groups: Group[], organization: Organization): Promise<RegistrationWithMember[]> {
        const registrations: RegistrationWithMember[] = []

        for (const registration of data) {
            registrations.push(await this.decryptRegistrationWithMember(registration, groups, organization))
        }

        return registrations
    }

    async encryptDetails(memberDetails: MemberDetails, publicKey: string, forOrganization: boolean, organization: Organization): Promise<EncryptedMemberDetails> {
        const data = JSON.stringify(new VersionBox(memberDetails).encode({ version: Version }))
        return EncryptedMemberDetails.create({
            publicKey: publicKey,
            ciphertext: await Sodium.sealMessage(data, publicKey),
            forOrganization,
            authorId: SessionManager.currentSession!.user!.id,
            publicData: EncryptedMemberDetails.getPublicData(memberDetails, organization),
            meta: MemberDetailsMeta.createFor(memberDetails)
        })
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