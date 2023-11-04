

import { ArrayDecoder, ConvertArrayToPatchableArray, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { MemberManagerBase, SessionManager } from '@stamhoofd/networking';
import { BalanceItem, EncryptedMemberWithRegistrations, Gender, Group, KeychainedResponseDecoder, MemberBalanceItem, MemberWithRegistrations, PermissionLevel, RegisterCartPriceCalculator, Registration, User } from '@stamhoofd/structures';

import { GroupSizeUpdater } from './GroupSizeUpdater';
import { OrganizationManager } from './OrganizationManager';

export type MemberChangeEvent = "changedGroup" | "deleted" | "created" | "payment" | 'updated'
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

    decryptMembersWithRegistrations(data: EncryptedMemberWithRegistrations[]): MemberWithRegistrations[] {
        const members: MemberWithRegistrations[] = []
        const groups = OrganizationManager.organization.groups

        for (const member of data) {
            const decryptedMember = MemberWithRegistrations.fromMember(
                member,
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

        return this.decryptMembersWithRegistrations(response.data.data)
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
                if (user.hasAccount) {
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
        return this.decryptMembersWithRegistrations(response.data)
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

    async deleteMembers(members: MemberWithRegistrations[]) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        const sizeUpdater = new GroupSizeUpdater();

        for (const member of members) {
            patchArray.addDelete(member.id);

            for (const registration of member.activeRegistrations) {
                sizeUpdater.add(registration, -1);
            }
        }
 
        await this.patchMembersAndSync(members, patchArray, false)
        const session = SessionManager.currentSession!
        sizeUpdater.save(session)

        for (const member of members) {
            this.callListeners("deleted", member)
        }
    }

    async deleteMember(member: MemberWithRegistrations) {
        await this.deleteMembers([member])
    }

    async unregisterMembers(members: MemberWithRegistrations[], groups: Group[] | null = null, cycleOffset = 0, waitingList = false) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        const sizeUpdater = new GroupSizeUpdater();

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            for (const registration of member.filterRegistrations({groups, waitingList, cycleOffset})) {
                patchMember.registrations.addDelete(registration.id)

                if (cycleOffset === 0) {
                    sizeUpdater.add(registration, -1);
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
        await this.patchMembersAndSync(members, patchArray, false)

        const session = SessionManager.currentSession!
        sizeUpdater.save(session)

        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async unregisterMember(member: MemberWithRegistrations, groups: Group[] | null = null, cycleOffset = 0, waitingList = false) {
        await this.unregisterMembers([member], groups, cycleOffset, waitingList)
    }

    async acceptFromWaitingList(members: MemberWithRegistrations[], groups: Group[] | null = null, cycleOffset = 0) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const sizeUpdater = new GroupSizeUpdater();

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            for (const registration of member.filterRegistrations({groups, cycleOffset, waitingList: true})) {
                const group = member.allGroups.find(g => g.id === registration.groupId)
                let price: number | undefined = undefined
                if (group) {
                    price = RegisterCartPriceCalculator.calculateSinglePrice(member, Registration.create({...registration, waitingList: false}), [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
                }

                patchMember.registrations.addPatch(Registration.patch({
                    id: registration.id,
                    waitingList: false,
                    price
                }))

                sizeUpdater.add({groupId: registration.groupId, waitingList: true, cycle: registration.cycle}, -1);
                sizeUpdater.add({groupId: registration.groupId, waitingList: false, cycle: registration.cycle}, 1);
            }
            
            patchArray.addPatch(patchMember)
        }
   
        await this.patchMembersAndSync(members, patchArray, false)

        const session = SessionManager.currentSession!
        sizeUpdater.save(session)

        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async registerMembers(members: MemberWithRegistrations[], group: Group, cycle: number, waitingList: boolean) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const sizeUpdater = new GroupSizeUpdater()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })
        
            // Check if we already have a registration for this group and cycle combination
            const registration = member.registrations.find(r => r.groupId === group.id && r.cycle === cycle);
            if (registration) {
                if (registration.waitingList && !waitingList) {
                    sizeUpdater.add({groupId: group.id, waitingList: true, cycle: registration.cycle}, -1);
                    sizeUpdater.add({groupId: group.id, waitingList: false, cycle: registration.cycle}, 1);

                    const price = RegisterCartPriceCalculator.calculateSinglePrice(member, Registration.create({...registration, waitingList: false}), [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
                    
                    // Do a patch to move this member from the waiting list
                    patchMember.registrations.addPatch(Registration.patch({
                        id: registration.id,
                        waitingList: false,
                        price
                    }))
                    patchArray.addPatch(patchMember)
                    continue
                }
                // Silently ignore unless we are moving to the waiting list
                if (!registration.waitingList && waitingList) {
                    throw new Error('' + member.name + ' is al ingeschreven bij '+group.settings.name+'. Je kan een lid niet inschrijven voor een wachtlijst voor een groep waarvoor het al is ingeschreven.')
                } 
                continue;
            }

            const reg = Registration.create({
                groupId: group.id,
                cycle: cycle,
                waitingList,
                registeredAt: new Date()
            })

            reg.price = RegisterCartPriceCalculator.calculateSinglePrice(member, reg, [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
            patchMember.registrations.addPut(reg)

            sizeUpdater.add({groupId: group.id, waitingList, cycle}, 1)
            patchArray.addPatch(patchMember)
        }

        await this.patchMembersAndSync(members, patchArray, false)
        
        const session = SessionManager.currentSession!
        sizeUpdater.save(session)

        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async moveCycle(members: MemberWithRegistrations[], groups: Group[] | null, cycleOffset: number, waitingList: boolean, newCycleOffset: number) {
        if (newCycleOffset === cycleOffset) {
            return;
        }
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        const sizeUpdater = new GroupSizeUpdater()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            for (const registration of member.filterRegistrations({groups, cycleOffset, waitingList})) {
                // Check if already has a registratino with these details, skip otherwise
                if (member.registrations.find(r => r.id !== registration.id && r.groupId === registration.groupId && r.cycle === registration.cycle + cycleOffset - newCycleOffset)) {
                    throw new Error('Al ingeschreven bij die groep in die periode')
                }

                patchMember.registrations.addPatch(Registration.patch({
                    id: registration.id,
                    cycle: registration.cycle + cycleOffset - newCycleOffset
                }))

                sizeUpdater.add({
                    groupId: registration.groupId, 
                    waitingList: registration.waitingList,
                    cycle: registration.cycle
                }, -1)
                sizeUpdater.add({
                    groupId: registration.groupId, 
                    waitingList: registration.waitingList,
                    cycle: registration.cycle + cycleOffset - newCycleOffset
                }, 1)
            }
            
            patchArray.addPatch(patchMember)
        }
 
        await this.patchMembersAndSync(members, patchArray, false)
        
        const session = SessionManager.currentSession!
        sizeUpdater.save(session)
        
        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async moveRegistrations(members: MemberWithRegistrations[], groups: Group[] | null, cycleOffset: number, waitingList: boolean, newGroup: Group) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        const sizeUpdater = new GroupSizeUpdater()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            for (const registration of member.filterRegistrations({groups, cycleOffset, waitingList})) {
                // Check if already has a registratino with these details, skip otherwise
                if (member.registrations.find(r => r.id !== registration.id && r.groupId === newGroup.id && r.cycle === newGroup.cycle + cycleOffset)) {
                    throw new Error('Je kan deze inschrijving niet verplaatsen omdat ' + member.name + ' al is ingeschreven bij die groep of daarbij horende wachtlijst in die periode')
                }

                patchMember.registrations.addPatch(Registration.patch({
                    id: registration.id,
                    groupId: newGroup.id,
                    cycle: newGroup.cycle + cycleOffset // offset won't change but cycle can
                }))

                sizeUpdater.add({
                    groupId: registration.groupId, 
                    waitingList: registration.waitingList,
                    cycle: registration.cycle
                }, -1)
                sizeUpdater.add({
                    groupId: newGroup.id, 
                    waitingList: waitingList,
                    cycle: newGroup.cycle + cycleOffset
                }, 1)
            }
            
            patchArray.addPatch(patchMember)
        }

        await this.patchMembersAndSync(members, patchArray, false)
        
        const session = SessionManager.currentSession!
        sizeUpdater.save(session)
        
        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }

    async moveToWaitingList(members: MemberWithRegistrations[], groups: Group[] | null = null, cycleOffset = 0) {
        const patchArray: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()
        const sizeUpdater = new GroupSizeUpdater()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            for (const registration of member.filterRegistrations({groups, cycleOffset, waitingList: false})) {
                patchMember.registrations.addPatch(Registration.patch({
                    id: registration.id,
                    waitingList: true
                }))

                sizeUpdater.add({
                    groupId: registration.groupId, 
                    waitingList: false,
                    cycle: registration.cycle
                }, -1)
                sizeUpdater.add({
                    groupId: registration.groupId, 
                    waitingList: true,
                    cycle: registration.cycle
                }, 1)
            }
            
            patchArray.addPatch(patchMember)
        }
 
        await this.patchMembersAndSync(members, patchArray, false)

        const session = SessionManager.currentSession!
        sizeUpdater.save(session)
        
        for (const member of members) {
            this.callListeners("changedGroup", member)
        }
    }
}

export const MemberManager = new MemberManagerStatic()