import type { MemberWithRegistrationsBlob, Organization, RecordWarning, SGVSyncStatus } from '@stamhoofd/structures';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import { computed, inject, provide } from 'vue';

export type SGVSyncWarning = {
    status:
        | SGVSyncStatus.Never
        | SGVSyncStatus.Outdated
        | SGVSyncStatus.Changed;
    text: string;
};

export type SGVSync = {
    sgvSyncOpen: () => Promise<void>;
    sgvSyncWarning: ComputedRef<SGVSyncWarning | null>;
    sgvSyncIsEnabled: ComputedRef<boolean>;
    sgvSyncMemberWarnings: ComputedRef<RecordWarning[]>;
    sgvSyncHandleWarningClick: (warning: RecordWarning) => void;
};

export type SGVSyncFactory = (
    members?: MaybeRefOrGetter<MemberWithRegistrationsBlob[]>,
    organization?: MaybeRefOrGetter<Organization | null | undefined>,
) => SGVSync;

const sgvSyncKey: InjectionKey<SGVSyncFactory> = Symbol('sgvSync');

export function useProvideSGVSyncFactory(factory: SGVSyncFactory) {
    provide(sgvSyncKey, factory);
}

/** Creates SGV sync in the consumer's setup context; stays disabled without a provider. */
export function useSGVSync(
    members?: MaybeRefOrGetter<MemberWithRegistrationsBlob[]>,
    organization?: MaybeRefOrGetter<Organization | null | undefined>,
): SGVSync {
    const factory = inject(sgvSyncKey, null);
    if (factory) {
        return factory(members, organization);
    }
    return {
        sgvSyncOpen: async () => {},
        sgvSyncWarning: computed(() => null),
        sgvSyncIsEnabled: computed(() => false),
        sgvSyncMemberWarnings: computed(() => []),
        sgvSyncHandleWarningClick: () => {},
    };
}
