import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder,VersionBox } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { Keychain, SessionManager } from '@stamhoofd/networking';
import { Address, EmergencyContact, EncryptedMember, EncryptedMemberWithRegistrations, KeychainItem, MemberDetails, MemberWithRegistrations, Parent, PatchMembers, Registration,User,Version } from '@stamhoofd/structures';

import { MemberManager } from './MemberManager';
import { OrganizationManager } from './OrganizationManager';

// Manage a complete family so you can sync changes across multiple members (addresses, parents, emergency contacts)
export class FamilyManager {
    /// Currently saved members
    members: MemberWithRegistrations[]

    constructor(members: MemberWithRegistrations[]) {
        this.members = members

        if (members.length == 1) {
            this.loadFamily(members[0].id).catch(e => {
                console.error(e)
            })
        }
    }

    async loadFamily(id: string) {
        const session = SessionManager.currentSession!
        // Send the request
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/members/"+id+"/family",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })
        this.setMembers(await MemberManager.decryptMembers(response.data))
    }

    async addMember(member: MemberDetails, registrations: Registration[]): Promise<MemberWithRegistrations | null> {
        member.cleanData()

        const session = SessionManager.currentSession!

        // Create a keypair for this member (and discard it immediately)
        // We might use the private key in the future to send an invitation or QR-code
        const keyPair = await Sodium.generateEncryptionKeyPair()

        // Add all the needed users that need to have access
        const users: User[] = []

        for (const email of member.getManagerEmails()) {
            users.push(User.create({
                email
            }))
        }

        // Create member
        const decryptedMember = MemberWithRegistrations.create({
            details: member,
            publicKey: keyPair.publicKey,
            registrations: registrations,
            firstName: member.firstName,
            placeholder: true,

            users,
            organizationPublicKey: "" // doesn't matter since we only going to set this when we encrypt it
        })

        const members = (this.members ?? []).filter(m => !!m.details)
        const encryptedMembers = await MemberManager.getEncryptedMembersPatch(members)
        const addMembers = await MemberManager.getEncryptedMembers([decryptedMember])

        const patchArray = new PatchableArray()
        for (const m of encryptedMembers) {
            patchArray.addPatch(m)
        }

        for (const m of addMembers) {
            patchArray.addPut(m)
        }
        
        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.setMembers(await MemberManager.decryptMembers(response.data))
        const m = this.members?.find(m => m.id == decryptedMember.id) ?? null

        MemberManager.callListeners("created", m)
        return m;
    }

    async patchMemberRegistrations(member: MemberWithRegistrations, registrations: PatchableArrayAutoEncoder<Registration>) {        
        const patchArray = new PatchableArray()
        patchArray.addPatch(MemberWithRegistrations.patch({
            id: member.id,
            registrations
        }))
 
        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })
        const m = (await MemberManager.decryptMembers(response.data))[0]

        const i = this.members.findIndex(_m => _m.id === m.id)
        if (i != -1) {
            this.members[i].copyFrom(m)
        }

        member.copyFrom(m)

        MemberManager.callListeners("changedGroup", member)
        return member
    }

    async patchAllMembersWith(member: MemberWithRegistrations) {
        const members = (this.members ?? []).filter(m => !!m.details)
        const ex = members.findIndex(m => m.id == member.id)

        if (ex !== -1) {
            members.splice(ex, 1, member)
        } else {
            members.push(member)
        }

        for (const m of members) {
            m.details?.cleanData()
        }

        const encryptedMembers = await MemberManager.getEncryptedMembersPatch(members)
        if (encryptedMembers.length == 0) {
            return;
        }

        const patchArray = new PatchableArray()
        for (const m of encryptedMembers) {
            patchArray.addPatch(m)
        }
 
        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.setMembers(await MemberManager.decryptMembers(response.data))
    }

    setMembers(newMembers: MemberWithRegistrations[]) {
        const s: MemberWithRegistrations[] = []

        for (const member of newMembers) {
            const m = this.members.find(_m => _m.id == member.id)

            if (m) {
                m.copyFrom(member)
                s.push(m)
            } else {
                s.push(member)
            }
        }

        this.members = s
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

}