

import { ArrayDecoder,ConvertArrayToPatchableArray, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding'
import { Keychain, MemberManagerBase, SessionManager } from '@stamhoofd/networking'
import {  EncryptedMemberWithRegistrations, Group, KeychainedResponseDecoder, MemberWithRegistrations, PermissionLevel, Registration, User } from '@stamhoofd/structures'

import { OrganizationManager } from './OrganizationManager';

export type MemberChangeEvent = "changedGroup" | "deleted" | "created" | "payment" | "encryption"
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
                await this.decryptMember(member),
                member.registrations,
                member.users,
                groups
            )
            members.push(decryptedMember)
        }

        return members;
    }

    async loadMembers(groupIds: string[] = [], waitingList: boolean | null = false, cycleOffset: number | null = 0): Promise<MemberWithRegistrations[]> {
        if (waitingList === null) {
            // Load both waiting list and without waiting list
            const members: MemberWithRegistrations[] = []
            members.push(...(await this.loadMembers(groupIds, true, cycleOffset)))
            members.push(...(await this.loadMembers(groupIds, false, cycleOffset)))
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        if (cycleOffset === null) {
            // Load both waiting list and without waiting list
            const members: MemberWithRegistrations[] = []
            members.push(...(await this.loadMembers(groupIds, waitingList, 1)))
            members.push(...(await this.loadMembers(groupIds, waitingList, 0)))

            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        const session = SessionManager.currentSession!

        if (groupIds.length === 0) {
            const members: MemberWithRegistrations[] = []
            for (const group of session.organization!.groups) {
                if (group.privateSettings && group.privateSettings.permissions.getPermissionLevel(session.user!.permissions!) !== PermissionLevel.None) {
                    members.push(...(await this.loadMembers([group.id], waitingList, cycleOffset)))
                }
            }
            // remove duplicates
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }

        if (groupIds.length > 1) {
            const members: MemberWithRegistrations[] = []
            for (const groupId of groupIds) {
                members.push(...(await this.loadMembers([groupId], waitingList, cycleOffset)))
            }
            // remove duplicates
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/group/" + groupIds[0] + "/members",
            decoder: new KeychainedResponseDecoder(new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)),
            query: { waitingList, cycleOffset }
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

    async getEncryptedMembersPatch(members: MemberWithRegistrations[]): Promise<PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>> {
        const encryptedMembers: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = new PatchableArray()

        for (const member of members) {
            // Check if this user has missing users
            const missing: PatchableArrayAutoEncoder<User> = new PatchableArray()
            const managers = member.details.getManagerEmails()
            for(const email of managers) {
                const user = member.users.find(u => u.email === email)
                if (!user) {
                    console.log("link email "+email)
                    missing.addPut(User.create({
                        email
                    }))
                } else {
                    console.log("already linked "+email)
                }
            }

            // Delete users that never created an account
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

            encryptedMembers.addPatch(
                EncryptedMemberWithRegistrations.patch({
                    id: member.id,
                    users: missing
                })
            )
        }

        // Aldo include encryption blobs
        const p = await this.getEncryptedMembers(members, OrganizationManager.organization, false)
        encryptedMembers.merge(p.members as any) // we can merge since it's a subtype
        return encryptedMembers
    }    

    async patchMembersDetails(members: MemberWithRegistrations[]): Promise<MemberWithRegistrations | null> {
        const patch = await this.getEncryptedMembers(members, OrganizationManager.organization, false)

        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patch.members,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })
        return (await this.decryptMembersWithRegistrations(response.data))[0] ?? null
    }

    async patchMembers(members: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>),
            body: members
        })
        return await this.decryptMembersWithRegistrations(response.data)
    }

    async deleteMembers(members: MemberWithRegistrations[]) {
        const patchArray = new PatchableArray()
        for (const member of members) (
            patchArray.addDelete(member.id)
        )
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", null)
    }

    async deleteMember(member: MemberWithRegistrations) {
        const patchArray = new PatchableArray()
        patchArray.addDelete(member.id)
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", member)
    }

    async unregisterMembers(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0, waitingList = false) {
        const patchArray = new PatchableArray()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === waitingList) {
                        patchMember.registrations.addDelete(registration.id)
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === waitingList) {
                        patchMember.registrations.addDelete(registration.id)
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", null)
    }

    async acceptFromWaitingList(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0) {
        const patchArray = new PatchableArray()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === true) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: false
                        }))
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === true) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: false
                        }))
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", null)
    }

    async moveToWaitingList(members: MemberWithRegistrations[], group: Group | null = null, cycleOffset = 0) {
        const patchArray = new PatchableArray()

        for (const member of members) {
            const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

            if (group === null) {
                for (const registration of member.activeRegistrations) {
                    if (registration.waitingList === false) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: true
                        }))
                    }
                }
            } else {
                for (const registration of member.registrations) {
                    if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === false) {
                        patchMember.registrations.addPatch(Registration.patch({
                            id: registration.id,
                            waitingList: true
                        }))
                    }
                }
            }
            
            patchArray.addPatch(patchMember)
        }
   
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", null)
    }

    async unregisterMember(member: MemberWithRegistrations, group: Group | null = null, cycleOffset = 0, waitingList = false) {
        const patchArray = new PatchableArray()
        const patchMember = EncryptedMemberWithRegistrations.patch({ id: member.id })

        if (group === null) {
            for (const registration of member.activeRegistrations) {
                if (registration.waitingList === waitingList) {
                    patchMember.registrations.addDelete(registration.id)
                }
            }
        } else {
            for (const registration of member.registrations) {
                if (registration.groupId === group.id && registration.cycle === group.cycle - cycleOffset && registration.waitingList === waitingList) {
                    patchMember.registrations.addDelete(registration.id)
                }
            }
        }

        patchArray.addPatch(patchMember)
 
        const session = SessionManager.currentSession!

        // Send the request
        await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: patchArray,
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
        })

        this.callListeners("deleted", member)
    }
}

export const MemberManager = new MemberManagerStatic()