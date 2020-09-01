

import { ArrayDecoder, Decoder, ObjectData, VersionBoxDecoder, VersionBox, ConvertArrayToPatchableArray, PatchableArray } from '@simonbackx/simple-encoding'
import { Sodium } from '@stamhoofd/crypto'
import { Keychain, SessionManager } from '@stamhoofd/networking'
import { MemberWithRegistrations, EncryptedMember, EncryptedMemberWithRegistrations, MemberDetails, Version, Member, Registration, RegistrationWithEncryptedMember, RegistrationWithMember } from '@stamhoofd/structures'
import { OrganizationManager } from './OrganizationManager';

export type MemberChangeEvent = "changedGroup" | "deleted" | "created" | "payment"
export type MembersChangedListener = (type: MemberChangeEvent, member: MemberWithRegistrations | null) => void


/**
 * Controls the fetching and decrypting of members
 */
export class MemberManagerStatic {
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


    async decryptMembersWithoutRegistrations(data: EncryptedMember[]) {
        // Save keychain items
        const members: Member[] = []
        const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)

        if (!keychainItem) {
            throw new Error("Missing organization keychain")
        }

        const session = SessionManager.currentSession!
        let keyPair: {
            publicKey: string;
            privateKey: string;
        } | undefined = undefined
        try {
            keyPair = await session.decryptKeychainItem(keychainItem)
        } catch (e) {
            console.error(e)
            console.error("Invalid keychain item (probably because user encryption key has changed)")
        }

        for (const member of data) {

            let decryptedDetails: MemberDetails | undefined

            if (!member.encryptedForOrganization) {
                console.warn("encryptedForOrganization not set for member " + member.id)
            } else if (!keyPair) {
                // no key
            } else {
                try {
                    const json = await Sodium.unsealMessage(member.encryptedForOrganization, keyPair.publicKey, keyPair.privateKey)
                    const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
                    decryptedDetails = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>)).data
                } catch (e) {
                    console.error(e)
                    console.error("Failed to read member data for " + member.id)
                }
            }

            if (!decryptedDetails) {
                decryptedDetails =  new MemberDetails()
                decryptedDetails.firstName = member.firstName
                decryptedDetails.setPlaceholder()
            }

            const decryptedMember = Member.create({
                id: member.id,
                firstName: member.firstName,
                details: decryptedDetails ?? null,
                publicKey: member.publicKey,
            })

            members.push(decryptedMember)
        }

        return members;
    }

    async decryptMembers(data: EncryptedMemberWithRegistrations[]) {
        // Save keychain items
        const members: MemberWithRegistrations[] = []
        const groups = OrganizationManager.organization.groups
        const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)

        if (!keychainItem) {
            throw new Error("Missing organization keychain")
        }

        const session = SessionManager.currentSession!
        let keyPair: {
            publicKey: string;
            privateKey: string;
        } | undefined = undefined
        try {
            keyPair = await session.decryptKeychainItem(keychainItem)
        } catch (e) {
            console.error(e)
            console.error("Invalid keychain item (probably because user encryption key has changed)")
        }

        for (const member of data) {

            let decryptedDetails: MemberDetails | undefined

            if (!member.encryptedForOrganization) {
                console.warn("encryptedForOrganization not set for member " + member.id)
            } else if (!keyPair) {
                // no key
            } else {
                try {
                    const json = await Sodium.unsealMessage(member.encryptedForOrganization, keyPair.publicKey, keyPair.privateKey)
                    const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
                    decryptedDetails = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>)).data
                } catch (e) {
                    console.error(e)
                    console.error("Failed to read member data for " + member.id)
                }
            }

            if (!decryptedDetails) {
                decryptedDetails =  new MemberDetails()
                decryptedDetails.firstName = member.firstName
                decryptedDetails.setPlaceholder()
            }

            const decryptedMember = MemberWithRegistrations.create({
                id: member.id,
                details: decryptedDetails,
                publicKey: member.publicKey,
                registrations: member.registrations,
                firstName: member.firstName
            })

            decryptedMember.fillGroups(groups)
            members.push(decryptedMember)
        }

        return members;
    }

    async loadMembers(groupId: string | null = null, waitingList = false): Promise<MemberWithRegistrations[]> {
        const session = SessionManager.currentSession!

        if (groupId === null) {
            const members: MemberWithRegistrations[] = []
            for (const group of session.organization!.groups) {
                if (session.user!.permissions!.hasReadAccess(group.id)) {
                    members.push(...(await this.loadMembers(group.id, waitingList)))
                }
            }
            // remove duplicates
            return Object.values(members.reduce((acc,cur)=>Object.assign(acc,{[cur.id]:cur}),{}))
        }
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/group/" + groupId + "/members",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>),
            query: waitingList ? { waitingList: true } : {}
        })
        return await this.decryptMembers(response.data)
    }

    getRegistrationsPatchArray(): ConvertArrayToPatchableArray<Registration[]> {
        return new PatchableArray()
    }

    getPatchArray(): ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]> {
        return new PatchableArray()
    }

    async patchMembers(members: ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>),
            body: members
        })
        return await this.decryptMembers(response.data)
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
}

export const MemberManager = new MemberManagerStatic()