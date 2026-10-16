import type { ComponentWithProperties, PushOptions } from '@simonbackx/vue-app-navigation';
import { MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { defineComponent, h, toRaw } from 'vue';
import { useProvideMemberViewLoaders } from '../memberViewLoaders';
import { useShowMember } from './useShowMember';

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('#fetchers/useMembersObjectFetcher.ts', () => ({
    useMembersObjectFetcher: () => ({ fetch }),
}));

test('member lookup presents the injected destination with the fetched member', async () => {
    const member = MemberWithRegistrationsBlob.create({});
    fetch.mockResolvedValue({ results: [member] });
    const present = vi.fn<(options: PushOptions) => Promise<void>>().mockResolvedValue(undefined);
    const destination = defineComponent(() => () => null);
    const loader = vi.fn(async () => ({ default: destination }));
    let showMember!: ReturnType<typeof useShowMember>;
    const Consumer = defineComponent({
        setup() {
            showMember = useShowMember();
            return () => null;
        },
    });
    const wrapper = mount(defineComponent({
        setup() {
            useProvideMemberViewLoaders({ member: loader, details: loader, messages: loader });
            return () => h(Consumer);
        },
    }), { global: { provide: { reactive_navigation_present: present } } });

    await showMember(member.id);
    const options = present.mock.calls[0][0];
    const root = options.components[0].properties.root as ComponentWithProperties;
    const pending = await (root.properties.promise as () => Promise<ComponentWithProperties>)();
    const resolved = await (pending.properties.promise as () => Promise<ComponentWithProperties>)();

    expect(fetch.mock.calls[0][0]).toMatchObject({ filter: { id: member.id }, limit: 1 });
    expect(loader).toHaveBeenCalledOnce();
    expect(resolved.component).toBe(destination);
    expect(toRaw(resolved.properties.member)).toBe(member);
    expect(options.modalDisplayStyle).toBe('popup');
    wrapper.unmount();
});
