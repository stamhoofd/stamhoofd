import { AutoEncoderPatchType, Decoder,ObjectData, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { Sodium } from "@stamhoofd/crypto"
import { EncryptedMember, EncryptedMemberDetails, Group, KeychainedMembers, Member,MemberDetails, MemberDetailsMeta, MemberWithRegistrations, Organization, RegistrationWithEncryptedMember, RegistrationWithMember, Version } from "@stamhoofd/structures"
import { Sorter } from "@stamhoofd/utility"

import { Keychain } from "./Keychain"
import { SessionManager } from "./SessionManager"

export class MemberManagerBase {
    async decryptMemberDetails(encrypted: EncryptedMemberDetails, organization: Organization): Promise<MemberDetails> {
        const keychainItem = Keychain.getItem(encrypted.publicKey)

        if (!keychainItem) {
            throw new Error("Keychain item missing for this member")
        }
        const session = SessionManager.currentSession!
        const keyPair = await session.decryptKeychainItem(keychainItem)
        const json = await Sodium.unsealMessage(encrypted.ciphertext, keyPair.publicKey, keyPair.privateKey)
        const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
        const decoded = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>))
        const details = decoded.data
        const version = data.field("version").integer

        if (version < 128) {
            details.upgradeFromLegacy(organization)
        }

        return details
    }

    async decryptMember(member: EncryptedMember, organization: Organization): Promise<Member> {
        // Get the newest complete blob where we have a key for
        const oldToNew = member.encryptedDetails.sort((a, b) => Sorter.byDateValue(b.meta.date, a.meta.date))

        let latest: MemberDetails | null = null
        let latestEncryptedDetails: EncryptedMemberDetails | null = null
        for (const encryptedDetails of oldToNew.slice().reverse()) {
            if (!encryptedDetails.meta.isRecovered) {
                // Do we have a key?
                if (Keychain.hasItem(encryptedDetails.publicKey) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        console.log("Found latest, not recovered encrypted details", encryptedDetails, encryptedDetails.meta.date)
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
                if (Keychain.hasItem(encryptedDetails.publicKey) && encryptedDetails.ciphertext.length > 0) {
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
                if (Keychain.hasItem(encryptedDetails.publicKey) && encryptedDetails.ciphertext.length > 0) {
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
    async getEncryptedMembers(members: MemberWithRegistrations[], organization: Organization, createPersonalKey = true, replaceMemberPublicKey: string | null = null): Promise<AutoEncoderPatchType<KeychainedMembers>> {
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

            // Search for a public key that we have + add all other keys that we need to encrypt for
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

                if (encryptedDetails.forOrganization || !replaceMemberPublicKey) {
                    // Only add organization keys and only members keys if we are not replacing all the member keys
                    keys.set(encryptedDetails.publicKey, encryptedDetails.forOrganization)
                }
            }

            if (replaceMemberPublicKey) {
                // Add this key in the encrypted details
                keys.set(replaceMemberPublicKey, false)
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

            // Clean the member details
            member.details.cleanData()

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