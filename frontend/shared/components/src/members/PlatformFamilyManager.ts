import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { Request, RequestResult } from "@simonbackx/simple-networking"
import { useContext } from "@stamhoofd/components"
import { SessionContext } from "@stamhoofd/networking"
import { MemberWithRegistrationsBlob, PlatformMember, Version } from "@stamhoofd/structures"
import { onBeforeUnmount, unref } from "vue"

export function usePlatformFamilyManager() {
    const context = useContext()
    const manager = new PlatformFamilyManager(unref(context))

    onBeforeUnmount(() => {
        manager.destroy()
    });

    return manager;
}

export class PlatformFamilyManager {
    context: SessionContext

    constructor(context: SessionContext) {
        this.context = context;
    }

    destroy() {
        Request.cancelAll(this)
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

            let response: RequestResult<MemberWithRegistrationsBlob[]>;
            try {
                response = await this.context.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/members",
                    decoder: new ArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>),
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

            for (const c of clearAfter.values()) {
                c.markSaved();
            }

            for (const updatedMember of response.data) {
                const existingMember = members.find(m => m.id === updatedMember.id);
                if (existingMember) {
                    existingMember.member.set(updatedMember)
                }
            }
        }
    }
}
