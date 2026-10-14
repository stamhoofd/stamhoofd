import { useMemberSync } from '@stamhoofd/components/members/memberSync';
import { MemberWithRegistrationsBlob, Organization, RecordWarning, SGVSyncStatus, TranslatedString } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref, shallowRef } from 'vue';
import { useProvideSGVMemberSync } from './provideSGVMemberSync';

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
    useSGVSync: () => ({
        sgvSyncOpen: open,
        sgvSyncWarning: computed(() => null),
        sgvSyncIsEnabled: computed(() => true),
    }),
}));

function useTestSync(status: SGVSyncStatus = SGVSyncStatus.Never) {
    const member = MemberWithRegistrationsBlob.create({});
    vi.spyOn(member, 'getSGVSyncStatus').mockReturnValue(status);
    const organization = shallowRef(Organization.create({}));
    vi.spyOn(organization.value, 'isSGVSyncOrganization', 'get').mockReturnValue(true);
    let sync!: ReturnType<typeof useMemberSync>;
    const Consumer = defineComponent({
        setup() {
            sync = useMemberSync([member], organization);
            return () => null;
        },
    });
    const wrapper = mount(defineComponent({
        setup() {
            useProvideSGVMemberSync();
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
    test.each([SGVSyncStatus.Never, SGVSyncStatus.Outdated, SGVSyncStatus.Changed])('opens synchronization for a translated %s warning', (status) => {
        const { sync, wrapper } = useTestSync(status);

        sync.handleWarningClick(sync.memberWarnings.value[0]);

        expect(open).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('does not mistake unrelated Dutch warnings for synchronization actions', () => {
        const { sync, wrapper } = useTestSync();
        sync.handleWarningClick(RecordWarning.create({
            text: TranslatedString.create('Controleer de synchronisatie met een andere dienst.'),
        }));

        expect(open).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    test('does not open synchronization after access is revoked', () => {
        const { sync, wrapper } = useTestSync();
        const warning = sync.memberWarnings.value[0];
        hasFullAccess.mockReturnValue(false);

        sync.handleWarningClick(warning);

        expect(open).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});
