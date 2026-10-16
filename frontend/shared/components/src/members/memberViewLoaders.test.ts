import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import type { MemberViewLoaders } from './memberViewLoaders';
import { useMemberViewLoaders, useProvideMemberViewLoaders } from './memberViewLoaders';

describe('Member view loader composition', () => {
    test('nested providers are isolated from siblings and other application roots', () => {
        const received: MemberViewLoaders[] = [];
        const view = defineComponent(() => () => null);
        const loaders = () => ({
            details: async () => ({ default: view }),
            member: async () => ({ default: view }),
            messages: async () => ({ default: view }),
        });
        const outer = loaders();
        const inner = loaders();
        const other = loaders();
        const Consumer = defineComponent({
            setup() {
                received.push(useMemberViewLoaders());
                return () => null;
            },
        });
        const Nested = defineComponent({
            setup() {
                useProvideMemberViewLoaders(inner);
                return () => h(Consumer);
            },
        });
        const createRoot = (value: MemberViewLoaders, nested: boolean) => defineComponent({
            setup() {
                useProvideMemberViewLoaders(value);
                return () => nested ? [h(Nested), h(Consumer)] : h(Consumer);
            },
        });

        const first = mount(createRoot(outer, true));
        const second = mount(createRoot(other, false));

        expect(received).toEqual([inner, outer, other]);
        expect(received[0]).toBe(inner);
        expect(received[1]).toBe(outer);
        expect(received[2]).toBe(other);
        first.unmount();
        second.unmount();
    });

    test('requires an explicit provider', () => {
        const wrapper = mount(defineComponent({
            setup() {
                expect(() => useMemberViewLoaders()).toThrow('Member view loaders have not been provided');
                return () => null;
            },
        }));
        wrapper.unmount();
    });
});
