

import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Keychain, MemberManagerBase, SessionManager } from '@stamhoofd/networking';
import { Address, EmergencyContact, EncryptedMember, EncryptedMemberWithRegistrations, KeychainedMembers, KeychainedResponse, KeychainedResponseDecoder, Member, MemberDetails, MemberWithRegistrations, Parent, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { Vue } from "vue-property-decorator";

import { OrganizationManager } from './OrganizationManager';

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic extends MemberManagerBase {
    /// Currently saved members
    members: MemberWithRegistrations[] | null = null

    /**
     * Set the members, but keep all the existing member references
     */
    setMembers(data: KeychainedResponse<EncryptedMemberWithRegistrations[]>) {
        // Save keychain items
        Keychain.addItems(data.keychainItems)

        const s: MemberWithRegistrations[] = []
        const groups = OrganizationManager.organization.groups

        for (const member of data.data) {
            const decryptedMember = MemberWithRegistrations.fromMember(
                this.decryptMember(member, OrganizationManager.organization),
                member.registrations,
                member.users,
                groups
            )

            const m = this.members?.find(_m => _m.id == member.id)

            if (m) {
                m.copyFrom(decryptedMember)
                s.push(m)
            } else {
                s.push(decryptedMember)
            }
        }

        Vue.set(this, "members", s)
    }

    async loadMembers() {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })
        this.setMembers(response.data)
    }

    async addMember(memberDetails: MemberDetails): Promise<MemberWithRegistrations | null> {
        const session = SessionManager.currentSession!

        // Create member
        const encryptedMember = EncryptedMember.create({
            firstName: memberDetails.firstName
        })

        // Prepare patch
        const patch = KeychainedMembers.patch({})

        // Add encryption blobs
        // Add encryption blob (only one)
        if (session.organization?.meta.didAcceptEndToEndEncryptionRemoval) {
            encryptedMember.nonEncryptedDetails = memberDetails
        } else {
            throw new SimpleError({
                code: "not_accepted_terms",
                message: 'Deze vereniging lijkt inactief te zijn. Neem contact op met de vereniging.'
            })
        }

        patch.members.addPut(encryptedMember)

        // Also update other members that might have been changed (e.g. when a shared address have been changed)
        const members = this.members ?? []
        patch.patch(this.getEncryptedMembers(members))

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/members",
            body: patch,
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>))
        })

        MemberManager.setMembers(response.data)
        return this.members?.find(m => m.id == encryptedMember.id) ?? null
    }

    /**
     * Patch all members that are not placeholders, and force a save for the given members (even when they are placeholders)
     */
    async patchAllMembersWith(...patchMembers: MemberWithRegistrations[]) {
        const members = this.members ?? []

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
        const patch = this.getEncryptedMembers(members)
        const session = SessionManager.currentSession!

        // Send the request
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/members",
            body: patch,
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
            if (member.details.emergencyContacts.length > 0) {
                const lastReviewed = member.details.reviewTimes.getLastReview("emergencyContacts")
                if ((lastReviewed && lastReviewed.getTime() > minDate) || minDate == -1) {
                    minDate = lastReviewed?.getTime() ?? -1
                    found = member.details.emergencyContacts[0]
                }
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
            
            if (member.details.doctor) {
                const lastReviewed = member.details.reviewTimes.getLastReview("records")
                if ((lastReviewed && lastReviewed.getTime() > minDate) || minDate == -1) {
                    minDate = lastReviewed?.getTime() ?? -1
                    found = member.details.doctor
                }
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