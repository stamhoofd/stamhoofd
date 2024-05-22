import { Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { Request, RequestResult } from "@simonbackx/simple-networking"
import { AppType, useAppContext, useContext } from "@stamhoofd/components"
import { SessionContext } from "@stamhoofd/networking"
import { MemberWithRegistrationsBlob, MembersBlob, PlatformMember, Version } from "@stamhoofd/structures"
import { onBeforeUnmount, unref } from "vue"

export function usePlatformFamilyManager() {
    const context = useContext()
    const app = useAppContext()

    if (app === 'auto') {
        throw new Error("usePlatformFamilyManager() cannot be used in the auto app context")
    }
    const manager = new PlatformFamilyManager(unref(context), app)

    onBeforeUnmount(() => {
        manager.destroy()
    });

    return manager;
}

export class PlatformFamilyManager {
    context: SessionContext
    app: AppType

    constructor(context: SessionContext, app: AppType) {
        this.context = context;
        this.app = app;
    }

    destroy() {
        Request.cancelAll(this)
    }

    async loadFamilyMembers(member: PlatformMember, options?: {shouldRetry?: boolean}) {
        const response = await this.context.authenticatedServer.request({
            method: "GET",
            path: `/organization/members/${member.id}/family`,
            decoder: MembersBlob as Decoder<MembersBlob>,
            owner: this,
            shouldRetry: options?.shouldRetry ?? false
        });

        member.family.insertFromBlob(response.data)
    }

    async save(members: PlatformMember[], shouldRetry: boolean = false) {
        // Load all members that have patches
        const patches: PatchableArrayAutoEncoder<MemberWithRegistrationsBlob> = new PatchableArray();
        
        const clearAfter: Set<PlatformMember> = new Set()

        for (const member of members) {
            if (member.isNew) {
                if (member.isSaving) {
                    throw new SimpleError({
                        code: 'save_pending',
                        message: 'Even geduld. Nog bezig met opslaan...'
                    })
                }
                patches.addPut(member.patchedMember)
                clearAfter.add(member)
            } else {
                if (patchContainsChanges(member.patch, member.member, {version: Version})) {
                    member.patch.id = member.member.id
                    patches.addPatch(member.patch)
                    clearAfter.add(member)
                }
            }
        }

        if (patches.changes.length) {
            for (const c of clearAfter.values()) {
                c.prepareSave();
            }

            let response: RequestResult<MembersBlob>;
            try {
                response = await this.context.authenticatedServer.request({
                    method: "PATCH",
                    path: this.app == 'registration' ? '/members' : "/organization/members",
                    decoder: MembersBlob as Decoder<MembersBlob>,
                    body: patches,
                    shouldRetry,
                    owner: this
                });
            } catch (e) {
                for (const c of clearAfter.values()) {
                    c.markFailedSave();
                }

                throw e;
            }

            const createdMembers = response.data.members.filter(m => ![...clearAfter.values()].find(mm => mm.id === m.id))

            for (const c of clearAfter.values()) {
                const savedMember = c.patchedMember // Before clearing the patches
                c.markSaved();

                // Check in response
                const updatedMember = response.data.members.find(m => m.id === c.id);
                if (updatedMember) {
                    c.member.set(updatedMember)
                } else {
                    // Probably duplicate member, so we have a different id
                    const updatedMember = createdMembers.find(m => m.details.isEqual(savedMember.details));
                    if (updatedMember) {
                        // We have an id change here
                        const oldId = c.id
                        c.member.set(updatedMember)
                        c.patch.id = updatedMember.id

                        c._oldId = oldId
                    } else {
                        console.error('Patched members but missing in response. This should not happen.', c)
                    }
                }
            }
        }
    }
}
