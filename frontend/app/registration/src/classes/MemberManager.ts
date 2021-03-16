

import { ArrayDecoder, AutoEncoderPatchType, Decoder, ObjectData, VersionBox,VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto'
import { Keychain, SessionManager } from '@stamhoofd/networking'
import { Address, EmergencyContact, EncryptedMember, EncryptedMemberDetails, EncryptedMemberWithRegistrations, KeychainedMembers, KeychainedResponse, KeychainedResponseDecoder, KeychainItem,Member, MemberDetails, MemberDetailsMeta, MemberWithRegistrations, Parent, PatchMembers, Payment, PaymentDetailed, RegistrationWithEncryptedMember, RegistrationWithMember, Version } from '@stamhoofd/structures'
import { Sorter } from '@stamhoofd/utility';
import { Vue } from "vue-property-decorator";

import { OrganizationManager } from './OrganizationManager';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic {
    /// Currently saved members
    members: MemberWithRegistrations[] | null = null

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
            throw new Error("not yet implemented")
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

    async getRegistrationsWithMember(data: RegistrationWithEncryptedMember[]): Promise<RegistrationWithMember[]> {

        const registrations: RegistrationWithMember[] = []
        const groups = OrganizationManager.organization.groups

        for (const registration of data) {
            const member = registration.member
            const decryptedMember = await this.decryptMember(member)

            const decryptedRegistration = RegistrationWithMember.create(Object.assign({}, registration, {
                member: decryptedMember,
                group: groups.find(g => g.id === registration.groupId)
            }))

            registrations.push(decryptedRegistration)
        }

        return registrations
    }

    async setMembers(data: KeychainedResponse<EncryptedMemberWithRegistrations[]>) {
        // Save keychain items
        Keychain.addItems(data.keychainItems)

        Vue.set(this, "members", [])
        const groups = OrganizationManager.organization.groups

        for (const member of data.data) {
            const decryptedMember = MemberWithRegistrations.fromMember(
                await this.decryptMember(member),
                member.registrations,
                member.users,
                groups
            )
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

    async encryptDetails(memberDetails: MemberDetails, publicKey: string, forOrganization: boolean): Promise<EncryptedMemberDetails> {
        const data = JSON.stringify(new VersionBox(memberDetails).encode({ version: Version }))
        return EncryptedMemberDetails.create({
            publicKey: publicKey,
            ciphertext: await Sodium.sealMessage(data, publicKey),
            byOrganization: false,
            forOrganization,
            authorId: SessionManager.currentSession!.user!.id,
            meta: MemberDetailsMeta.createFor(memberDetails)
        })
    }

    async addMember(memberDetails: MemberDetails): Promise<MemberWithRegistrations | null> {
        const session = SessionManager.currentSession!

        // Create a keypair
        const keyPair = await Sodium.generateEncryptionKeyPair()
        const keychainItem = await session.createKeychainItem(keyPair)

        // Create member
        const encryptedMember = EncryptedMember.create({
            firstName: memberDetails.firstName
        })

        // Add encryption blobs
        encryptedMember.encryptedDetails.push(await this.encryptDetails(memberDetails, keyPair.publicKey, false))
        encryptedMember.encryptedDetails.push(await this.encryptDetails(memberDetails, OrganizationManager.organization.publicKey, true))

        // Prepare patch
        const patch = KeychainedMembers.patch({})
        patch.keychainItems.addPut(keychainItem)
        patch.members.addPut(encryptedMember)

        // Also update other members that might have been changed (e.g. when a shared address have been changed)
        const members = (this.members ?? []).filter(m => !m.details.isPlaceholder)
        patch.patch(await this.getEncryptedMembers(members))

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/user/members",
            body: patch,
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })

        await MemberManager.setMembers(response.data)
        return this.members?.find(m => m.id == encryptedMember.id) ?? null
    }

    /// Prepare a patch of updated members
    async getEncryptedMembers(members: MemberWithRegistrations[]): Promise<AutoEncoderPatchType<KeychainedMembers>> {
        const patch = KeychainedMembers.patch({})
        const session = SessionManager.currentSession!

        for (const member of members) {
            // Gather all public keys that we are going to encrypt for
            const keys = new Set<string>()

            // Add access for the organization
            keys.add(OrganizationManager.organization.publicKey)

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
                    break
                }
                keys.add(encryptedDetails.publicKey)
            }

            if (!doWeHaveOne) {
                // Create a new one
                const keyPair = await Sodium.generateEncryptionKeyPair()
                const keychainItem = await session.createKeychainItem(keyPair)

                // Add this key in the encrypted details
                keys.add(keyPair.publicKey)
                patch.keychainItems.addPut(keychainItem)
            }

            const memberPatch = EncryptedMember.patch({ id: member.id })

            for (const publicKey of keys) {
                const encryptedDetails = await this.encryptDetails(
                    member.details,
                    publicKey,
                    OrganizationManager.organization.publicKey === publicKey
                )
                
                const keychainItem = Keychain.getItem(encryptedDetails.publicKey)
                if (!keychainItem) {
                    const oldKeys = member.encryptedDetails.filter(e => e.publicKey === publicKey)
                    // If we don't have this key ourselves, don't update the date to today, because
                    // we need to save which keys were last used
                    if (oldKeys.length > 0) {
                        encryptedDetails.meta.ownerDate = new Date(Math.max(...oldKeys.map(m => m.meta.date.getTime())))
                    } else {
                        // Was encrypted for the first time for this key (probably organization key), keep current date
                    }
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

    /**
     * Patch all members that are not placeholders, and force a save for the given members (even when they are placeholders)
     */
    async patchAllMembersWith(...patchMembers: MemberWithRegistrations[]) {
        const members = (this.members ?? []).filter(m => !m.details.isPlaceholder)

        for (const member of patchMembers) {
            const ex = members.findIndex(m => m.id == member.id)
            if (ex !== -1) {
                members.splice(ex, 1, member)
            } else {
                members.push(member)
            }
        }
        
        return await this.patchMembers(members)
    }

    async patchMembers(members: MemberWithRegistrations[]) {
        const patch = await this.getEncryptedMembers(members)
        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/user/members",
            body: patch,
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })
        await this.setMembers(response.data)
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

    /**
     * Get last updated emergency contact
     */
    getEmergencyContact(): EmergencyContact | null {
        if (!this.members) {
            return null
        }
        let minDate = -1
        let found: EmergencyContact | null = null

        for (const member of this.members) {
            if (!member.details) {
                continue
            }
            if (member.details.emergencyContacts.length > 0 && member.details.lastReviewed && member.details.lastReviewed.getTime() > minDate) {
                minDate = member.details.lastReviewed.getTime()
                found = member.details.emergencyContacts[0]
            }
        }

        return found
    }

    /**
     * Get last updated emergency contact
     */
    getDoctor(): EmergencyContact | null {
        if (!this.members) {
            return null
        }
        let minDate = -1
        let found: EmergencyContact | null = null

        for (const member of this.members) {
            if (!member.details) {
                continue
            }
            if (member.details.doctor && member.details.lastReviewed && member.details.lastReviewed.getTime() > minDate) {
                minDate = member.details.lastReviewed.getTime()
                found = member.details.doctor
            }
        }

        return found
    }

    updateAddress(oldValue: Address, newValue: Address) {
        if (!this.members) {
            return
        }

        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            member.details.updateAddress(oldValue, newValue)
        }
    }

    /// Update all references to this parent (with same id)
    updateParent(parent: Parent) {
        if (!this.members) {
            return
        }

        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            member.details.updateParent(parent)
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


    getPaymentDetailed(payment: Payment) {
        if (payment instanceof PaymentDetailed) {
            return payment
        }

        const detailed = PaymentDetailed.create(Object.assign({
            registrations: []
        }, payment))

        if (!MemberManager.members) {
            return detailed
        }
        
        const groups = OrganizationManager.organization.groups
        for (const member of MemberManager.members) {
            for (const registration of member.registrations) {
                if (!registration.payment || registration.payment.id != payment.id) {
                    continue;
                }

                const group = groups.find(g => g.id == registration.groupId)
                if (!group) {
                    continue;
                }
                const reg = RegistrationWithMember.create(
                    Object.assign({
                        member,
                        group
                    }, registration)
                );
                detailed.registrations.push(reg)
            }
        }
        return detailed
    }

    /**
     * Get registrations that are up to date
     */
    getLatestRegistrations(members: Member[]): RegistrationWithMember[] {
        if (!MemberManager.members) {
            return []
        }

        const registrations: RegistrationWithMember[] = []
        const groups = OrganizationManager.organization.groups
        for (const member of MemberManager.members) {
            if (!members.find(m => m.id == member.id)) {
                continue;
            }

            for (const registration of member.registrations) {
                // todo
                if (registration.createdAt > new Date(new Date().getTime() - 10*1000)) {
                    continue;
                }

                const group = groups.find(g => g.id == registration.groupId)
                if (!group) {
                    continue;
                }
                const reg = RegistrationWithMember.create(
                    Object.assign({
                        member,
                        group
                    }, registration)
                );
                registrations.push(reg)
            }
        }
        return registrations
    }

}

export const MemberManager = new MemberManagerStatic();

(window as any).MemberManager = MemberManager;