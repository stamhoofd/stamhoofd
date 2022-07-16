

import { ArrayDecoder,ConvertArrayToPatchableArray, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto';
import { Keychain, LoginHelper, MemberManagerBase, SessionManager } from '@stamhoofd/networking'
import {  EncryptedMemberWithRegistrations, Gender, Group, KeychainedResponseDecoder, MemberWithRegistrations, Organization, PermissionLevel, Registration, User } from '@stamhoofd/structures'

import { OrganizationManager } from './OrganizationManager';

export type MemberChangeEvent = "changedGroup" | "deleted" | "created" | "payment"
export type MembersChangedListener = (type: MemberChangeEvent, member: MemberWithRegistrations | null) => void


/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic extends MemberManagerBase {
    protected listeners: Map<any, MembersChangedListener> = new Map()

    addListener(owner: any, listener: MembersChangedListener) {
        this.listeners.set(owner, listener)
    }

    removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    callListeners(type: MemberChangeEvent, member: MemberWithRegistrations | null) {
        for (const listener of this.listeners.values()) {
            listener(type, member)
        }
    }

    async decryptMembersWithRegistrations(data: EncryptedMemberWithRegistrations[]) {
        const members: MemberWithRegistrations[] = []
        const groups = OrganizationManager.organization.groups

        for (const member of data) {
            const decryptedMember = MemberWithRegistrations.fromMember(
                await this.decryptMember(member, OrganizationManager.organization),
                member.registrations,
                member.users,
                groups
            )
            members.push(decryptedMember)
        }

        return members;
    }

    async loadMembers(groupIds: string[] = [], waitingList: boolean | null = false, cycleOffset: number | null = 0, owner?: any): Promise<MemberWithRegistrations[]> {
        if (waitingList === null) {
            // Load both waiting list and without waiting list
            const members: MemberWithRegistrations[] = []
            members.push(...(await this.loadMembers(groupIds, true, cycleOffset, owner)))
            members.push(...(await this.loadMembers(groupIds, false, cycleOffset, owner)))
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        if (cycleOffset === null) {
            // Load both current and future cycle
            const members: MemberWithRegistrations[] = []
            members.push(...(await this.loadMembers(groupIds, waitingList, 1, owner)))
            members.push(...(await this.loadMembers(groupIds, waitingList, 0, owner)))

            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        const session = SessionManager.currentSession!

        if (groupIds.length === 0) {
            const members: MemberWithRegistrations[] = []
            for (const group of session.organization!.groups) {
                if (group.privateSettings && group.privateSettings.permissions.getPermissionLevel(session.user!.permissions!) !== PermissionLevel.None) {
                    members.push(...(await this.loadMembers([group.id], waitingList, cycleOffset, owner)))
                }
            }
            // remove duplicates
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        if (groupIds.length > 1) {
            const members: MemberWithRegistrations[] = []
            for (const groupId of groupIds) {
                members.push(...(await this.loadMembers([groupId], waitingList, cycleOffset, owner)))
            }
            // remove duplicates
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/group/" + groupIds[0] + "/members",
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)),
            query: { waitingList, cycleOffset },
            owner
        })

        Keychain.addItems(response.data.keychainItems)
        return await this.decryptMembersWithRegistrations(response.data.data)
    }

    getRegistrationsPatchArray(): ConvertArrayToPatchableArray<Registration[]> {
        return new PatchableArray()
    }

    getPatchArray(): ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]> {
        return new PatchableArray()
    }

    /**
     * Return a list of patches that is needed to create users that provide all parents and members access to the given members
     * OR that removes access in some situations
     */
    getMembersAccessPatch(members: MemberWithRegistrations[]): PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> {
        const encryptedMembers: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        for (const member of members) {

            // Check if this user has missing users
            const missing: PatchableArrayAutoEncoder<User> = new PatchableArray()
            const managers = member.details.getManagerEmails()
            for(const email of managers) {
                const user = member.users.find(u => u.email === email)
                if (!user) {
                    console.log("Linking email "+email)
                    missing.addPut(User.create({
                        email
                    }))
                }
            }

            // Delete users that never created an account and are not in managers
            for (const user of member.users) {
                if (user.publicKey) {
                    continue
                }

                const exists = managers.find(m => m === user.email)
                if (!exists) {
                    // This email has been removed from the managers
                    missing.addDelete(user.id)
                }
            }

            if (missing.changes.length > 0) {
                encryptedMembers.addPatch(
                    EncryptedMemberWithRegistrations.patch({
                        id: member.id,
                        users: missing
                    })
                )
            }
        }

        return encryptedMembers
    }

    /**
     * Update the users that are connected to these members
     */
    async updateMembersAccess(members: MemberWithRegistrations[]) {
        // Update the users that are connected to these members
        const encryptedMembers: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = this.getMembersAccessPatch(members)

        if (encryptedMembers.changes.length > 0) {
            await this.patchMembersAndSync(members, encryptedMembers)
        }
    }   

    getEncryptedMembersPatch(members: MemberWithRegistrations[]): PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> {
        // Update the users that are connected to these members
        const encryptedMembers: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = this.getMembersAccessPatch(members)

        // Aldo include encryption blobs
        const p = this.getEncryptedMembers(members)
        encryptedMembers.merge(p.members as any) // we can merge since it's a subtype
        return encryptedMembers
    }
    
    private chunkArray<T>(array: T[], size = 10): T[][] {
        const chunked: T[][] = []

        for (let i = 0;  i < array.length; i += size) {
            chunked.push(array.slice(i, i + size))
        }

        return chunked
    }

    async patchMembersDetails(members: MemberWithRegistrations[], shouldRetry = true): Promise<void> {
        // Patch maximum 10 members at the same time
        const chunked = this.chunkArray(members, 10)

        for (const group of chunked) {
            await this.patchMembersAndSync(group, this.getEncryptedMembersPatch(group), shouldRetry)
        }
    }

    async patchMembers(patch: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>, shouldRetry = true) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>),
            body: patch,
            shouldRetry
        })
        return await this.decryptMembersWithRegistrations(response.data)
    }

    /**
     * Replace as many references in newerData to references in old members, but update the data in
     * those old members to match the new data
     */
    sync(members: MemberWithRegistrations[], newerData: MemberWithRegistrations[]) {
        for (const member of members) {
            const i = newerData.findIndex(m => m.id === member.id)
            if (i !== -1) {
                const updatedData = newerData[i]
                member.set(updatedData)
                newerData[i] = member
            }
        }
    }

    /**
     * Patch members and update the data of members instead of creating new instances
     */
    async patchMembersAndSync(members: MemberWithRegistrations[], patch: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>, shouldRetry = true) {
        const updated = await this.patchMembers(patch, shouldRetry)
        return this.sync(members, updated)
    }

    async deleteMembers(members: MemberWithRegistrations[]) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        for (const member of members) (
            patchArray.addDelete(member.id)
        )
 
        const session = SessionManager.currentSession!

        await this.patchMembersAndSync(members, patchArray, false)

        // Update counts
        let updateOrganization = false
        for (const member of members) {
            for (const registration of member.activeRegistrations) {
                const group = session.organization?.groups.find(g => g.id === registration.groupId)
                if (group) {
                    if (group.settings.waitingListSize !== null && registration.waitingList) {
                        group.settings.waitingListSize = Math.max(0, group.settings.waitingListSize - 1)
                        updateOrganization = true
                    }

                    if (group.settings.registeredMembers !== null && !registration.waitingList) {
                        group.settings.registeredMembers = Math.max(0, group.settings.registeredMembers - 1)
                        updateOrganization = true
                    }
                }
            }
        }

        if (updateOrganization) {
            // Save organization to disk
            SessionManager.currentSession?.callListeners("organization")
        }

        for (const member of members) {
            this.callListeners("deleted", member)
        }
    }

    async deleteMember(member: MemberWithRegistrations) {
        await this.deleteMembers([member])
    }

    async unregisterMembers(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0, waitingList = false) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const countMap: Map<string, number> = new Map()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === waitingList) {
                        patchMember.registrations.addDelete(registration.id)
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === waitingList) {
                        patchMember.registrations.addDelete(registration.id)
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!
        await this.patchMembersAndSync(members, patchArray, false)

        // Update group counts only when succesfully adjusted
        if (cycleOffset === 0) {
            let updateOrganization = false
            for (const [groupId, count] of countMap) {
                const group = session.organization?.groups.find(g => g.id === groupId)
                if (group) {
                    if (group.settings.waitingListSize !== null && waitingList) {
                        group.settings.waitingListSize = Math.max(0, group.settings.waitingListSize - count)
                        updateOrganization = true
                    }

                    if (group.settings.registeredMembers !== null && !waitingList) {
                        group.settings.registeredMembers = Math.max(0, group.settings.registeredMembers - count)
                        updateOrganization = true
                    }
                }
            }

            if (updateOrganization) {
                // Save organization to disk
                SessionManager.currentSession?.callListeners("organization")
            }
        }

        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async unregisterMember(member: MemberWithRegistrations, group: Group | null = null, cycleOffset = 0, waitingList = false) {
        await this.unregisterMembers([member], group, cycleOffset, waitingList)
    }

    async acceptFromWaitingList(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const countMap: Map<string, number> = new Map()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === true) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: false
                        }))
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === true) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: false
                        }))
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!

        await this.patchMembersAndSync(members, patchArray, false)

        // Update group counts only when succesfully adjusted
        if (cycleOffset === 0) {
            let updateOrganization = false
            for (const [groupId, count] of countMap) {
                const group = session.organization?.groups.find(g => g.id === groupId)
                if (group) {
                    if (group.settings.waitingListSize !== null) {
                        group.settings.waitingListSize = Math.max(0, group.settings.waitingListSize - count)
                        updateOrganization = true
                    }

                    if (group.settings.registeredMembers !== null) {
                        group.settings.registeredMembers += count
                        updateOrganization = true
                    }
                }
            }

            if (updateOrganization) {
                // Save organization to disk
                SessionManager.currentSession?.callListeners("organization")
            }
        }

        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async deleteDataExceptContacts(members: MemberWithRegistrations[]) {
        for (const member of members) {
            member.details.birthDay = null
            member.details.gender = Gender.Other
            member.details.reviewTimes.removeReview("details")

            member.details.records = []
            member.details.reviewTimes.removeReview("records")

            member.details.recordAnswers = []
            member.details.requiresFinancialSupport = undefined

            member.details.emergencyContacts = []
            member.details.doctor = null
            member.details.reviewTimes.removeReview("emergencyContacts")

            if (!member.details.age || member.details.age >= 18) {
                member.details.parents = []
                member.details.reviewTimes.removeReview("parents")
            }
        }
        await this.patchMembersDetails(members)
    }

    async deleteData(members: MemberWithRegistrations[]) {
        for (const member of members) {
            member.details.address = null
            member.details.gender = Gender.Other

            member.details.phone = null
            member.details.email = null
            member.details.birthDay = null
            member.details.address = null

            member.details.reviewTimes.removeReview("details")

            member.details.records = []
            member.details.reviewTimes.removeReview("records")

            member.details.recordAnswers = []
            member.details.requiresFinancialSupport = undefined

            member.details.emergencyContacts = []
            member.details.doctor = null
            member.details.reviewTimes.removeReview("emergencyContacts")

            member.details.parents = []
            member.details.reviewTimes.removeReview("parents")
        }
        await this.patchMembersDetails(members)
    }

    async moveToWaitingList(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const countMap: Map<string, number> = new Map()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === false) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: true
                        }))
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === false) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: true
                        }))
                        countMap.set(registration.groupId, (countMap.get(registration.groupId) || 0) + 1)
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!
        await this.patchMembersAndSync(members, patchArray, false)

        // Update group counts only when succesfully adjusted
        if (cycleOffset === 0) {
            let updateOrganization = false
            for (const [groupId, count] of countMap) {
                const group = session.organization?.groups.find(g => g.id === groupId)
                if (group) {
                    if (group.settings.waitingListSize !== null) {
                        group.settings.waitingListSize += count
                        updateOrganization = true
                    }

                    if (group.settings.registeredMembers !== null) {
                        group.settings.registeredMembers = Math.max(0, group.settings.registeredMembers - count)
                        updateOrganization = true
                    }
                }
            }

            if (updateOrganization) {
                // Save organization to disk
                SessionManager.currentSession?.callListeners("organization")
            }
        }
        
        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }
}

export const MemberManager = new MemberManagerStatic()