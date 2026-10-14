import type { MemberWithRegistrationsBlob, Organization, RecordWarning } from '@stamhoofd/structures';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import { computed, inject, provide } from 'vue';

export type MemberSync = {
    open: () => Promise<void>;
    warning: ComputedRef<{ text: string; isError: boolean } | null>;
    isEnabled: ComputedRef<boolean>;
    memberWarnings: ComputedRef<RecordWarning[]>;
    handleWarningClick: (warning: RecordWarning) => void;
};

export type MemberSyncFactory = (
    members?: MaybeRefOrGetter<MemberWithRegistrationsBlob[]>,
    organization?: MaybeRefOrGetter<Organization | null | undefined>,
) => MemberSync;

const memberSyncKey: InjectionKey<MemberSyncFactory> = Symbol('memberSync');

export function useProvideMemberSync(factory: MemberSyncFactory) {
    provide(memberSyncKey, factory);
}

export function useMemberSync(
    members?: MaybeRefOrGetter<MemberWithRegistrationsBlob[]>,
    organization?: MaybeRefOrGetter<Organization | null | undefined>,
): MemberSync {
    const factory = inject(memberSyncKey, null);
    if (factory) {
        return factory(members, organization);
    }
    return {
        open: async () => {},
        warning: computed(() => null),
        isEnabled: computed(() => false),
        memberWarnings: computed(() => []),
        handleWarningClick: () => {},
    };
}
