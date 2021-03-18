import { AutoEncoderPatchType, Decoder,ObjectData, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding"
import { Sodium } from "@stamhoofd/crypto"
import { EncryptedMember, EncryptedMemberDetails, KeychainedMembers, Member,MemberDetails, MemberDetailsMeta, MemberWithRegistrations, Version } from "@stamhoofd/structures"
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

        let latest: EncryptedMemberDetails | null = null
        for (const encryptedDetails of member.encryptedDetails) {
            if (!encryptedDetails.meta.incomplete && (!latest || latest.meta.date < encryptedDetails.meta.date)) {
                // Do we have a key?
                const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                if (keychainItem) {
                    latest = encryptedDetails
                }
            }
        }

        if (!latest) {
            // We don't have complete data.
            // Use the last one available
            for (const encryptedDetails of member.encryptedDetails) {
                if (!latest || latest.meta.date < encryptedDetails.meta.date) {
                    // Do we have a key?
                    const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                    if (keychainItem) {
                        latest = encryptedDetails
                    }
                }
            }
        }

        if (!latest) {
            // todo: return placeholder
            const details = new MemberDetails()
            details.firstName = member.firstName
            details.setPlaceholder()
            return Member.create({ ...member, details })
        }

        const details = await this.decryptMemberDetails(latest)

        if (!latest.meta.incomplete) {
            // Search for updates that are not complete after this date
            for (const encryptedDetails of member.encryptedDetails) {
                if (latest.meta.date < encryptedDetails.meta.date) {
                    const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                    if (keychainItem) {
                        const updates = await this.decryptMemberDetails(encryptedDetails)
                        details.applyChange(updates)
                    }
                }
            }
        } else {
            // The details are not complete, so mark them
            details.setPlaceholder()
        }

        return Member.create({ ...member, details })
    }

    async encryptDetails(memberDetails: MemberDetails, publicKey: string, forOrganization: boolean): Promise<EncryptedMemberDetails> {
        const data = JSON.stringify(new VersionBox(memberDetails).encode({ version: Version }))
        return EncryptedMemberDetails.create({
            publicKey: publicKey,
            ciphertext: await Sodium.sealMessage(data, publicKey),
            forOrganization,
            authorId: SessionManager.currentSession!.user!.id,
            meta: MemberDetailsMeta.createFor(memberDetails)
        })
    }

    /// Prepare a patch of updated members
    async getEncryptedMembers(members: MemberWithRegistrations[], organizationPublicKey: string, createPersonalKey = true): Promise<AutoEncoderPatchType<KeychainedMembers>> {
        const patch = KeychainedMembers.patch({})
        const session = SessionManager.currentSession!

        for (const member of members) {
            // Gather all public keys that we are going to encrypt for
            const keys = new Set<string>()

            // Add access for the organization
            keys.add(organizationPublicKey)

            // Check if we have at least one key where we have the private key for
            let doWeHaveOne = false

            // Search for a public key that we have
            // Sort details from new to old
            for (const encryptedDetails of member.encryptedDetails.sort((a, b) => Sorter.byDateValue(a.meta.date, b.meta.date))) {
                if (encryptedDetails.forOrganization) {
                    // Only use the last one for an organization
                    continue
                }

                if (!doWeHaveOne) {
                    const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                    if (keychainItem) {
                        // We could use this one
                        doWeHaveOne = true

                        // Always include this one
                        keys.add(encryptedDetails.publicKey)
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
                keys.add(encryptedDetails.publicKey)
            }

            if (createPersonalKey && !doWeHaveOne) {
                // Create a new one
                const keyPair = await Sodium.generateEncryptionKeyPair()
                const keychainItem = await session.createKeychainItem(keyPair)

                // Add this key in the encrypted details
                keys.add(keyPair.publicKey)
                patch.keychainItems.addPut(keychainItem)
            }

            const memberPatch = EncryptedMember.patch({ id: member.id })
            memberPatch.firstName = member.details.firstName

            for (const publicKey of keys) {
                const encryptedDetails = await this.encryptDetails(
                    member.details,
                    publicKey,
                    organizationPublicKey === publicKey
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

            if (!member.details.isPlaceholder) {
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