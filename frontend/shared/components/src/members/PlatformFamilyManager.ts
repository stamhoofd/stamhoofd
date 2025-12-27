import { Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request, RequestResult } from '@simonbackx/simple-networking';
import { useAppContext, useContext } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { AppType, MemberDetails, MemberWithRegistrationsBlob, MembersBlob, PlatformFamily, PlatformMember, Registration, UitpasNumberDetails, Version } from '@stamhoofd/structures';
import { onBeforeUnmount, unref } from 'vue';
import { updateContextFromMembersBlob } from './helpers/updateContextFromMembersBlob';

export function usePlatformFamilyManager() {
    const context = useContext();
    const app = useAppContext();

    if (app === 'auto') {
        throw new Error('usePlatformFamilyManager() cannot be used in the auto app context');
    }
    const manager = new PlatformFamilyManager(unref(context), app);

    onBeforeUnmount(() => {
        manager.destroy();
    });

    return manager;
}

/**
 * @deprecated
 * All methods should be moved to new hooks.
 * We should step away from using global classes like this.
 */
export class PlatformFamilyManager {
    context: SessionContext;
    app: AppType;

    constructor(context: SessionContext, app: AppType) {
        this.context = context;
        this.app = app;
    }

    destroy() {
        Request.cancelAll(this);
    }

    async unregisterMembers(members: { member: PlatformMember; removeRegistrations: Registration[] }[], options?: { shouldRetry?: boolean }) {
        const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;

        for (const { member, removeRegistrations } of members) {
            const registrations = new PatchableArray() as PatchableArrayAutoEncoder<Registration>;
            for (const r of removeRegistrations) {
                registrations.addDelete(r.id);
            }

            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                registrations,
            });

            patches.addPatch(patch);
        }

        await this.isolatedPatch(members.map(m => m.member), patches, options?.shouldRetry ?? false);
    }

    async isolatedPatch(members: PlatformMember[], patches: PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>, shouldRetry: boolean = false) {
        if (patches.changes.length) {
            MembersBlob.markAllStale();
            const response = await this.context.authenticatedServer.request({
                method: 'PATCH',
                path: this.app == 'registration' ? '/members' : '/organization/members',
                decoder: MembersBlob as Decoder<MembersBlob>,
                body: patches,
                shouldRetry,
                owner: this,
            });
            response.data.markReceivedFromBackend();

            // Remove deleted members from family
            for (const memberId of patches.getDeletes()) {
                const member = members.find(m => m.id === memberId);
                if (member) {
                    member.family.deleteMember(memberId);
                }
            }

            PlatformFamily.updateFromBlob(members, response.data);
            updateContextFromMembersBlob(this.context, response.data);
        }
    }

    async forceUpdateUitpasSocialTarrif(members: PlatformMember[]): Promise<boolean> {
        const patches: PatchableArrayAutoEncoder<MemberWithRegistrationsBlob> = new PatchableArray();

        const clearAfter: Set<PlatformMember> = new Set();

        for (const member of members) {
            if (member.isNew || member.member.details.uitpasNumberDetails === null) {
                continue;
            }

            const uitpasNumber: string = member.member.details.uitpasNumberDetails.uitpasNumber;

            if (uitpasNumber) {
                patches.addPatch(MemberWithRegistrationsBlob.patch({
                    id: member.id,
                    details: MemberDetails.patch({
                        uitpasNumberDetails: UitpasNumberDetails.patch({
                            uitpasNumber,
                        }),
                    }),
                }));
                clearAfter.add(member);
            }
        }

        const hasChanges = patches.changes.length > 0;

        await this.savePatches(members, patches, clearAfter, true);
        return hasChanges;
    }

    async save(members: PlatformMember[], shouldRetry: boolean = false) {
        // Load all members that have patches
        const patches: PatchableArrayAutoEncoder<MemberWithRegistrationsBlob> = new PatchableArray();

        const clearAfter: Set<PlatformMember> = new Set();

        for (const member of members) {
            if (member.isNew) {
                if (member.isSaving) {
                    throw new SimpleError({
                        code: 'save_pending',
                        message: $t('562011ab-f3c5-4269-9db0-b6119f3aca54'),
                    });
                }
                patches.addPut(member.patchedMember);
                clearAfter.add(member);
            }
            else {
                if (patchContainsChanges(member.patch, member.member, { version: Version })) {
                    member.patch.id = member.member.id;
                    patches.addPatch(member.patch);
                    clearAfter.add(member);
                }
            }
        }

        await this.savePatches(members, patches, clearAfter, shouldRetry);
    }

    private async savePatches(members: PlatformMember[], patches: PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>, clearAfter: Set<PlatformMember>, shouldRetry: boolean) {
        if (patches.changes.length) {
            for (const c of clearAfter.values()) {
                c.prepareSave();
            }

            let response: RequestResult<MembersBlob>;
            try {
                MembersBlob.markAllStale();

                response = await this.context.authenticatedServer.request({
                    method: 'PATCH',
                    path: this.app === 'registration' ? '/members' : '/organization/members',
                    decoder: MembersBlob as Decoder<MembersBlob>,
                    body: patches,
                    shouldRetry,
                    owner: this,
                });

                // Make sure we use local time, so this is never stale
                response.data.markReceivedFromBackend();
            }
            catch (e) {
                for (const c of clearAfter.values()) {
                    c.markFailedSave();
                }

                throw e;
            }

            for (const c of clearAfter.values()) {
                const savedMember = c.patchedMember; // Before clearing the patches
                c.markSaved();

                // Check in response
                const updatedMember = response.data.members.find(m => m.id === c.id || m.details.oldIds.includes(c.id));
                if (updatedMember) {
                    c.member.deepSet(updatedMember);
                    c.patch.id = updatedMember.id;
                }
                else {
                    console.error('Patched members but missing in response. This should not happen.', savedMember, c);
                }
            }

            // Also insert the organizations into the families and deep set all the data we received
            PlatformFamily.updateFromBlob(members, response.data);
            updateContextFromMembersBlob(this.context, response.data);
        }
    }
}
