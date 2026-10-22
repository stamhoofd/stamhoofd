import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { EventWebshopViewLoaders } from './eventWebshopViewLoaders.ts';
import { useEventWebshopViewLoaders, useProvideEventWebshopViewLoaders } from './eventWebshopViewLoaders.ts';

describe('Event webshop view loader composition', () => {
    test('nested providers are isolated from siblings and other application roots', () => {
        const received: EventWebshopViewLoaders[] = [];
        const view = defineComponent(() => () => null);
        const loaders = (): EventWebshopViewLoaders => ({
            overview: async () => view,
            edit: async () => ({ default: view }),
        });
        const outer = loaders();
        const inner = loaders();
        const other = loaders();
        const Consumer = defineComponent({
            setup() {
                received.push(useEventWebshopViewLoaders());
                return () => null;
            },
        });
        const Nested = defineComponent({
            setup() {
                useProvideEventWebshopViewLoaders(inner);
                return () => h(Consumer);
            },
        });
        const createRoot = (value: EventWebshopViewLoaders, nested: boolean) => defineComponent({
            setup() {
                useProvideEventWebshopViewLoaders(value);
                return () => nested ? [h(Nested), h(Consumer)] : h(Consumer);
            },
        });

        const first = mount(createRoot(outer, true));
        const second = mount(createRoot(other, false));

        expect(received[0]).toBe(inner);
        expect(received[1]).toBe(outer);
        expect(received[2]).toBe(other);
        first.unmount();
        second.unmount();
    });

    test('preserves the separate overview and editor loaders without loading during setup', async () => {
        const overview = defineComponent(() => () => null);
        const editor = defineComponent(() => () => null);
        const overviewLoader = vi.fn(async () => overview);
        const editLoader = vi.fn(async () => ({ default: editor }));
        let received!: EventWebshopViewLoaders;
        const Consumer = defineComponent({
            setup() {
                received = useEventWebshopViewLoaders();
                return () => null;
            },
        });
        const wrapper = mount(defineComponent({
            setup() {
                useProvideEventWebshopViewLoaders({ overview: overviewLoader, edit: editLoader });
                return () => h(Consumer);
            },
        }));

        expect(received.overview).toBe(overviewLoader);
        expect(received.edit).toBe(editLoader);
        expect(overviewLoader).not.toHaveBeenCalled();
        expect(editLoader).not.toHaveBeenCalled();
        expect(await received.overview()).toBe(overview);
        expect(editLoader).not.toHaveBeenCalled();
        expect((await received.edit()).default).toBe(editor);
        expect(overviewLoader).toHaveBeenCalledOnce();
        expect(editLoader).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('requires an explicit provider', () => {
        const wrapper = mount(defineComponent({
            setup() {
                expect(() => useEventWebshopViewLoaders()).toThrow('Event webshop view loaders have not been provided');
                return () => null;
            },
        }));
        wrapper.unmount();
    });
});
