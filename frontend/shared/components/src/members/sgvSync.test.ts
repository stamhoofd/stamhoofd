import { MemberWithRegistrationsBlob, Organization } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, getCurrentInstance, h, shallowRef } from 'vue';
import type { SGVSync } from './sgvSync';
import { useSGVSync, useProvideSGVSyncFactory } from './sgvSync';

describe('SGV synchronization composition', () => {
    test('remains disabled without an integration provider', async () => {
        let sync!: SGVSync;
        const wrapper = mount(defineComponent({
            setup() {
                sync = useSGVSync();
                return () => null;
            },
        }));

        expect(sync.sgvSyncIsEnabled.value).toBe(false);
        expect(sync.sgvSyncWarning.value).toBeNull();
        expect(sync.sgvSyncMemberWarnings.value).toEqual([]);
        await expect(sync.sgvSyncOpen()).resolves.toBeUndefined();
        wrapper.unmount();
    });

    test('creates integrations in each consumer setup with its reactive inputs', () => {
        const members = shallowRef([MemberWithRegistrationsBlob.create({})]);
        const organization = shallowRef(Organization.create({}));
        const instances: unknown[] = [];
        const factory = vi.fn((): SGVSync => {
            instances.push(getCurrentInstance());
            return {
                sgvSyncOpen: async () => {},
                sgvSyncWarning: computed(() => null),
                sgvSyncIsEnabled: computed(() => true),
                sgvSyncMemberWarnings: computed(() => []),
                sgvSyncHandleWarningClick: () => {},
            };
        });
        const Consumer = defineComponent({
            setup() {
                expect(useSGVSync(members, organization).sgvSyncIsEnabled.value).toBe(true);
                return () => null;
            },
        });
        const wrapper = mount(defineComponent({
            setup() {
                useProvideSGVSyncFactory(factory);
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
