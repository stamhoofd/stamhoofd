import { MemberWithRegistrationsBlob, Organization } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, getCurrentInstance, h, shallowRef } from 'vue';
import type { MemberSync } from './memberSync';
import { useMemberSync, useProvideMemberSync } from './memberSync';

describe('Member synchronization composition', () => {
    test('remains disabled without an integration provider', async () => {
        let sync!: MemberSync;
        const wrapper = mount(defineComponent({
            setup() {
                sync = useMemberSync();
                return () => null;
            },
        }));

        expect(sync.isEnabled.value).toBe(false);
        expect(sync.warning.value).toBeNull();
        expect(sync.memberWarnings.value).toEqual([]);
        await expect(sync.open()).resolves.toBeUndefined();
        wrapper.unmount();
    });

    test('creates integrations in each consumer setup with its reactive inputs', () => {
        const members = shallowRef([MemberWithRegistrationsBlob.create({})]);
        const organization = shallowRef(Organization.create({}));
        const instances: unknown[] = [];
        const factory = vi.fn((): MemberSync => {
            instances.push(getCurrentInstance());
            return {
                open: async () => {},
                warning: computed(() => null),
                isEnabled: computed(() => true),
                memberWarnings: computed(() => []),
                handleWarningClick: () => {},
            };
        });
        const Consumer = defineComponent({
            setup() {
                expect(useMemberSync(members, organization).isEnabled.value).toBe(true);
                return () => null;
            },
        });
        const wrapper = mount(defineComponent({
            setup() {
                useProvideMemberSync(factory);
                return () => [h(Consumer), h(Consumer)];
            },
        }));

        expect(factory).toHaveBeenCalledTimes(2);
        expect(factory).toHaveBeenNthCalledWith(1, members, organization);
        expect(factory).toHaveBeenNthCalledWith(2, members, organization);
        expect(instances[0]).not.toBeNull();
        expect(instances[1]).not.toBe(instances[0]);
        wrapper.unmount();
    });
});
