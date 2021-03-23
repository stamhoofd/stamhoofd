import { AutoEncoderPatchType, Decoder,ObjectData, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { Sodium } from "@stamhoofd/crypto"
import { EncryptedMember, EncryptedMemberDetails, Group, KeychainedMembers, Member,MemberDetails, MemberDetailsMeta, MemberWithRegistrations, Organization, RegistrationWithEncryptedMember, RegistrationWithMember, Version } from "@stamhoofd/structures"
import { Sorter } from "@stamhoofd/utility"

import { Keychain } from "./Keychain"
import { SessionManager } from "./SessionManager"

export class MemberManagerBase {
    async decryptMemberDetails(encrypted: EncryptedMemberDetails): Promise<MemberDetails> {
        const keychainItem = Keychain.getItem(encrypted.publicKey)

        if (!keychainItem) {
            throw new Error("Keychain item missing for this member")
        }
        const session = SessionManager.currentSession!
        const keyPair = await session.decryptKeychainItem(keychainItem)
        const json = await Sodium.unsealMessage(encrypted.ciphertext, keyPair.publicKey, keyPair.privateKey)
        const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
        return data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>)).data
    }

    async decryptMember(member: EncryptedMember): Promise<Member> {
        // Get the newest complete blob where we have a key for
        const oldToNew = member.encryptedDetails.sort((a, b) => Sorter.byDateValue(b.meta.date, a.meta.date))

        let latest: MemberDetails | null = null
        let latestEncryptedDetails: EncryptedMemberDetails | null = null
        for (const encryptedDetails of oldToNew.slice().reverse()) {
            if (!encryptedDetails.meta.isRecovered) {
                // Do we have a key?
                if (Keychain.hasItem(encryptedDetails.publicKey)) {
                    latest = await this.decryptMemberDetails(encryptedDetails)
                    latestEncryptedDetails = encryptedDetails
                    break
                }
            }
        }

        if (!latest) {
            // We don't have complete data.
            // Use the oldest available recovered blob and keep applying all the updates
            for (const encryptedDetails of oldToNew) {
                // Do we have a key?
                if (Keychain.hasItem(encryptedDetails.publicKey)) {
                    latest = await this.decryptMemberDetails(encryptedDetails)
                    latestEncryptedDetails = encryptedDetails

                    // We need the oldest
                    break
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
                if (Keychain.hasItem(encryptedDetails.publicKey)) {
                    const updates = await this.decryptMemberDetails(encryptedDetails)
                    details.merge(updates)
                } else {
                    if (encryptedDetails.publicData) {
                        // Merge the non-encrypted blob of data
                        details.merge(encryptedDetails.publicData)
                    }
                }
            }
        }

        return Member.create({ ...member, details })
    }

    async decryptMembers(data: EncryptedMember[]) {
        const members: Member[] = []
        for (const member of data) {
            members.push(await this.decryptMember(member))
        }
        return members
    }

    async decryptRegistrationWithMember(registration: RegistrationWithEncryptedMember, groups: Group[]): Promise<RegistrationWithMember> {
        const member = registration.member
        const decryptedMember = await this.decryptMember(member)

        const decryptedRegistration = RegistrationWithMember.create(Object.assign({}, registration, {
            member: decryptedMember,
            group: groups.find(g => g.id === registration.groupId)
        }))

        return decryptedRegistration
    }

    async decryptRegistrationsWithMember(data: RegistrationWithEncryptedMember[], groups: Group[]): Promise<RegistrationWithMember[]> {
        const registrations: RegistrationWithMember[] = []

        for (const registration of data) {
            registrations.push(await this.decryptRegistrationWithMember(registration, groups))
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
    async getEncryptedMembers(members: MemberWithRegistrations[], organization: Organization, createPersonalKey = true): Promise<AutoEncoderPatchType<KeychainedMembers>> {
        const patch = KeychainedMembers.patch({})
        const session = SessionManager.currentSession!
        const organizationPublicKey = organization.publicKey

        for (const member of members) {
            // Gather all public keys that we are going to encrypt for
            const keys = new Map<string, boolean>()

            // Add access for the organization
            keys.set(organizationPublicKey, true)

            // Check if we have at least one key where we have the private key for
            let doWeHaveOne = false

            if (Keychain.hasItem(organizationPublicKey)) {
                doWeHaveOne = true
            }

            // Search for a public key that we have
            // Sort details from new to old
            for (const encryptedDetails of member.encryptedDetails.sort((a, b) => Sorter.byDateValue(a.meta.date, b.meta.date))) {
                if (encryptedDetails.forOrganization && (doWeHaveOne || createPersonalKey)) {
                    // Only use the last one for an organization, unless we don't have the key and we are not planning to add one
                    continue
                }

                if (!doWeHaveOne) {
                    if (Keychain.hasItem(encryptedDetails.publicKey)) {
                        // We could use this one
                        doWeHaveOne = true

                        // Always include this one
                        keys.set(encryptedDetails.publicKey, encryptedDetails.forOrganization)
                    }
                }

                // Keep appending until maximum 5 keys
                // 5 most recently used keys
                if (keys.size > 5) {
                    if (doWeHaveOne) {
                        break
                    }
                    // Keep going, we might find one that we have access to
                    continue
                }
                keys.set(encryptedDetails.publicKey, encryptedDetails.forOrganization)
            }

            if (createPersonalKey && !doWeHaveOne) {
                // Create a new one
                const keyPair = await Sodium.generateEncryptionKeyPair()
                const keychainItem = await session.createKeychainItem(keyPair)

                // Add this key in the encrypted details
                keys.set(keyPair.publicKey, false)
                patch.keychainItems.addPut(keychainItem)
            } else {
                if (!doWeHaveOne) {
                    throw new SimpleError({
                        code: "missing_key",
                        message: "Je kan deze leden niet bewerken omdat je geen sleutel hebt"
                    })
                }
            }

            const memberPatch = EncryptedMember.patch({ id: member.id })
            memberPatch.firstName = member.details.firstName

            for (const [publicKey, forOrganization] of keys) {
                const encryptedDetails = await this.encryptDetails(
                    member.details,
                    publicKey,
                    organizationPublicKey === publicKey || forOrganization,
                    organization
                )
                
                const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                if (!keychainItem) {
                    const oldKeys = member.encryptedDetails.filter(e => e.publicKey === publicKey)
                    // If we don't have this key ourselves, don't update the date to today, because
                    // we need to save which keys were last used
                    // Save the date that someone with the private key encrypted a blob with the same public key
                    if (oldKeys.length > 0) {
                        encryptedDetails.meta.ownerDate = new Date(Math.max(...oldKeys.map(m => m.meta.date.getTime())))
                    } else {
                        // Was encrypted for the first time for this key (probably organization key), keep current date
                    }
                } else {
                    // We have the owner date
                }

                memberPatch.encryptedDetails.addPut(
                    encryptedDetails
                )
            }

            if (doWeHaveOne && !member.details.isRecovered) {
                // We have new and complete data, delete all older keys
                for (const encryptedDetails of member.encryptedDetails) {
                    memberPatch.encryptedDetails.addDelete(encryptedDetails.id)
                }
            }

            patch.members.addPatch(memberPatch)
        }

        return patch
    }
}