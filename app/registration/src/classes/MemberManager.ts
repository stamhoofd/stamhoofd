

import { ArrayDecoder, Decoder, ObjectData, VersionBoxDecoder, VersionBox } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto'
import { Keychain, SessionManager } from '@stamhoofd/networking'
import { MemberWithRegistrations, EncryptedMember, EncryptedMemberWithRegistrations, KeychainedResponse, KeychainedResponseDecoder, MemberDetails, Version, PatchMembers, Parent, Address, Payment, PaymentDetailed, RegistrationWithMember, Member, RegistrationWithEncryptedMember, EmergencyContact, KeychainItem } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator";
import { OrganizationManager } from './OrganizationManager';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic {
    /// Currently saved members
    members: MemberWithRegistrations[] | null = null

    async getRegistrationsWithMember(data: RegistrationWithEncryptedMember[]): Promise<RegistrationWithMember[]> {

        const registrations: RegistrationWithMember[] = []
        const groups = OrganizationManager.organization.groups

        for (const registration of data) {
            const member = registration.member
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
                    } catch (e) {
                        console.error(e)
                        console.error("Failed to read member data for " + member.id)
                    }
                }

            }

            const decryptedMember = Member.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey,
                firstName: member.firstName,
                placeholder: member.placeholder
            })

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
            const keychainItem = Keychain.getItem(member.publicKey)

            let decryptedDetails: MemberDetails | null = null
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
                    } catch (e) {
                        console.error(e)
                        console.error("Failed to read member data for " + member.id)
                    }
                }

            }

            const decryptedMember = MemberWithRegistrations.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey,
                registrations: member.registrations,
                firstName: member.firstName,
                placeholder: member.placeholder
            })
            decryptedMember.fillGroups(groups)

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

    async addMember(member: MemberDetails): Promise<MemberWithRegistrations | null> {
        const session = SessionManager.currentSession!

        // Create a keypair
        const keyPair = await Sodium.generateEncryptionKeyPair()
        const keychainItem = await session.createKeychainItem(keyPair)

        // Create member
        const decryptedMember = MemberWithRegistrations.create({
            details: member,
            publicKey: keyPair.publicKey,
            registrations: [],
            firstName: member.firstName,
            placeholder: false
        })

        const members = (this.members ?? []).filter(m => !!m.details)
        const { encryptedMembers, keychainItems} = await this.getEncryptedMembers(members)
        const addMembers = (await this.getEncryptedMembers([decryptedMember])).encryptedMembers
        keychainItems.push(keychainItem)

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/user/members",
            body: PatchMembers.create({
                addMembers,
                updateMembers: encryptedMembers,
                keychainItems: keychainItems
            }),
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })

        await MemberManager.setMembers(response.data)

        return this.members?.find(m => m.id == decryptedMember.id) ?? null
    }

    async getEncryptedMembers(members: MemberWithRegistrations[]): Promise<{encryptedMembers: EncryptedMember[], keychainItems: KeychainItem[]}> {
        const encryptedMembers: EncryptedMember[] = [];
        const keychainItems: KeychainItem[] = []

        for (const member of members) {
            if (!member.details) {
                throw new Error("Can't save member with undefined details!")
            }
            const data = JSON.stringify(new VersionBox(member.details).encode({ version: Version }))

            // Check if we still have the public key of this member.
            let keychainItem = Keychain.getItem(member.publicKey)
            if (!keychainItem) {
                const session = SessionManager.currentSession!
                // Create a keypair
                const keyPair = await Sodium.generateEncryptionKeyPair()
                keychainItem = await session.createKeychainItem(keyPair)
                member.publicKey = keychainItem.publicKey
                keychainItems.push(keychainItem)
            }

            encryptedMembers.push(
                EncryptedMember.create({
                    id: member.id,
                    encryptedForOrganization: await Sodium.sealMessage(data, OrganizationManager.organization.publicKey),
                    encryptedForMember: await Sodium.sealMessage(data, member.publicKey),
                    publicKey: member.publicKey,
                    firstName: member.details.firstName,
                    placeholder: false,
                    createdAt: member.createdAt,
                    updatedAt: member.updatedAt
                })
            )
        }
        return {encryptedMembers, keychainItems}
    }

    async patchAllMembersWith(...patchMembers: MemberWithRegistrations[]) {
        const members = (this.members ?? []).filter(m => !!m.details)

        for (const member of patchMembers) {
            const ex = members.findIndex(m => m.id == member.id)
            if (ex !== -1) {
                members.splice(ex, 1, member)
            } else {
                members.push(member)
            }
        }
        
        const { encryptedMembers, keychainItems } = await this.getEncryptedMembers(members)
        if (encryptedMembers.length == 0) {
            return;
        }

        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/user/members",
            body: PatchMembers.create({
                addMembers: [],
                updateMembers: encryptedMembers,
                keychainItems: keychainItems
            }),
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })
        await this.setMembers(response.data)
    }

    async patchMembers(members: MemberWithRegistrations[]) {

        const { encryptedMembers, keychainItems} = await this.getEncryptedMembers(members)
         if (encryptedMembers.length == 0) {
            return;
        }

        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/user/members",
            body: PatchMembers.create({
                addMembers: [],
                updateMembers: encryptedMembers,
                keychainItems: keychainItems
            }),
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