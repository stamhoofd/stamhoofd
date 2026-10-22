import { useSGVSync } from '@stamhoofd/components/members/sgvSync';
import type { SGVSyncWarning } from '@stamhoofd/components/members/sgvSync';
import { MemberWithRegistrationsBlob, Organization, RecordWarning, SGVSyncStatus, TranslatedString } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref, shallowRef } from 'vue';
import { useProvideSGVSync } from './provideSGVSync';
import { useSGVSync as useSGVSyncImplementation } from './useSGVSync';

const { open, hasFullAccess, isMemberManaged } = vi.hoisted(() => ({
    open: vi.fn<() => Promise<void>>(),
    hasFullAccess: vi.fn<() => boolean>(),
    isMemberManaged: vi.fn<() => boolean>(),
}));

vi.mock('@stamhoofd/components/hooks/useAuth', () => ({
    useAuth: () => ({ hasFullAccess }),
}));
vi.mock('@stamhoofd/components/hooks/useOrganization', () => ({
    useOrganization: () => ref(null),
}));
vi.mock('./SGVSyncReport.ts', () => ({ isMemberManaged }));
vi.mock('./useSGVSync.ts', () => ({
    useSGVSync: vi.fn(() => ({
        sgvSyncOpen: open,
        sgvSyncWarning: computed(() => null),
        sgvSyncIsEnabled: computed(() => true),
    })),
}));

function useTestSync(status: SGVSyncStatus = SGVSyncStatus.Never) {
    const member = MemberWithRegistrationsBlob.create({});
    vi.spyOn(member, 'getSGVSyncStatus').mockReturnValue(status);
    const organization = shallowRef(Organization.create({}));
    vi.spyOn(organization.value, 'isSGVSyncOrganization', 'get').mockReturnValue(true);
    let sync!: ReturnType<typeof useSGVSync>;
    const Consumer = defineComponent({
        setup() {
            sync = useSGVSync([member], organization);
            return () => null;
        },
    });
    const wrapper = mount(defineComponent({
        setup() {
            useProvideSGVSync();
            return () => h(Consumer);
        },
    }));
    return { sync, wrapper, organization };
}

beforeEach(() => {
    open.mockResolvedValue(undefined);
    hasFullAccess.mockReturnValue(true);
    isMemberManaged.mockReturnValue(true);
    vi.stubGlobal('$t', () => 'Ces données doivent être mises à jour.');
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe('SGV member warning actions', () => {
    test.each([SGVSyncStatus.Never, SGVSyncStatus.Outdated, SGVSyncStatus.Changed] as const)('preserves the original %s warning and reactive state', (status) => {
        const warning = shallowRef<SGVSyncWarning | null>({ status, text: 'SGV sync warning' });
        const enabled = ref(true);
        const implementation = {
            sgvSyncOpen: open,
            sgvSyncWarning: computed(() => warning.value),
            sgvSyncIsEnabled: computed(() => enabled.value),
        };
        vi.mocked(useSGVSyncImplementation).mockReturnValueOnce(implementation);
        const { sync, wrapper } = useTestSync();

        expect(sync.sgvSyncOpen).toBe(implementation.sgvSyncOpen);
        expect(sync.sgvSyncWarning).toBe(implementation.sgvSyncWarning);
        expect(sync.sgvSyncWarning.value).toEqual({ status, text: 'SGV sync warning' });
        expect(sync.sgvSyncIsEnabled).toBe(implementation.sgvSyncIsEnabled);

        warning.value = null;
        enabled.value = false;
        expect(sync.sgvSyncWarning.value).toBeNull();
        expect(sync.sgvSyncIsEnabled.value).toBe(false);
        wrapper.unmount();
    });

    test.each([SGVSyncStatus.Never, SGVSyncStatus.Outdated, SGVSyncStatus.Changed])('opens synchronization for a translated %s warning', (status) => {
        const { sync, wrapper } = useTestSync(status);

        sync.sgvSyncHandleWarningClick(sync.sgvSyncMemberWarnings.value[0]);

        expect(open).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('does not mistake unrelated Dutch warnings for synchronization actions', () => {
        const { sync, wrapper } = useTestSync();
        sync.sgvSyncHandleWarningClick(RecordWarning.create({
            text: TranslatedString.create('Controleer de synchronisatie met een andere dienst.'),
        }));

        expect(open).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    test('does not open synchronization after access is revoked', () => {
        const { sync, wrapper } = useTestSync();
        const warning = sync.sgvSyncMemberWarnings.value[0];
        hasFullAccess.mockReturnValue(false);

        sync.sgvSyncHandleWarningClick(warning);

        expect(open).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});
