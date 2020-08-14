import { MemberWithRegistrations, EncryptedMember, KeychainItem, Version, PatchMembers, EncryptedMemberWithRegistrations, Address, Parent, EmergencyContact } from '@stamhoofd/structures';
import { VersionBox, ArrayDecoder, PatchableArray, Decoder } from '@simonbackx/simple-encoding';
import { Keychain, SessionManager } from '@stamhoofd/networking';
import { Sodium } from '@stamhoofd/crypto';
import { OrganizationManager } from './OrganizationManager';
import { MemberManager } from './MemberManager';

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
        this.members = await MemberManager.decryptMembers(response.data)
    }

    async getEncryptedMembers(members: MemberWithRegistrations[]): Promise<EncryptedMember[]> {
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
                    publicKey: member.publicKey,
                    firstName: member.details.firstName,
                    placeholder: false
                })
            )
        }
        return encryptedMembers
    }

    async patchAllMembersWith(member: MemberWithRegistrations) {
        const members = (this.members ?? []).filter(m => !!m.details)
        const ex = members.findIndex(m => m.id == member.id)


        if (ex !== -1) {
            members.splice(ex, 1, member)
        } else {
            members.push(member)
        }
        const encryptedMembers = await this.getEncryptedMembers(members)
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
        this.members = await MemberManager.decryptMembers(response.data)
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