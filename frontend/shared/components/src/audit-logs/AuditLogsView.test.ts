import type { ComponentWithProperties, PushOptions } from '@browser/navigation';
import { AuditLogReplacementType } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { toRaw } from 'vue';
import AuditLogsContentView from './AuditLogsContentView.vue';
import AuditLogsView from './AuditLogsView.vue';
import type { AuditLogCustomRenderers } from './components/RenderTextComponent.ts';

vi.mock('./AuditLogsContentView.vue', () => ({
    default: {
        props: ['objectIds', 'customRenderers', 'openLogs'],
        render: () => null,
    },
}));

test('forwards filters and custom renderers to content and recursively filtered popups', async () => {
    const customRenderers: AuditLogCustomRenderers = {
        [AuditLogReplacementType.User]: () => () => 'Custom user',
    };
    const present = vi.fn<(options: PushOptions) => Promise<void>>().mockResolvedValue(undefined);
    const wrapper = mount(AuditLogsView, {
        props: { objectIds: ['initial-object'], customRenderers },
        global: { provide: { reactive_navigation_present: present } },
    });

    try {
        const content = wrapper.findComponent(AuditLogsContentView);
        expect(content.props('objectIds')).toEqual(['initial-object']);
        expect(toRaw(content.props('customRenderers'))).toBe(customRenderers);
        const openLogs = content.props('openLogs') as (objectId: string) => Promise<void>;

        await openLogs('first-object');
        const firstOptions = present.mock.calls[0][0];
        const first = await (firstOptions.components[0].properties.promise as () => Promise<ComponentWithProperties>)();
        expect(firstOptions.modalDisplayStyle).toBe('popup');
        expect(first.component).toBe(AuditLogsContentView);
        expect(first.properties.objectIds).toEqual(['first-object']);
        expect(toRaw(first.properties.customRenderers)).toBe(customRenderers);
        expect(first.properties.openLogs).toBe(openLogs);

        await (first.properties.openLogs as typeof openLogs)('second-object');
        const secondOptions = present.mock.calls[1][0];
        const second = await (secondOptions.components[0].properties.promise as () => Promise<ComponentWithProperties>)();
        expect(secondOptions.modalDisplayStyle).toBe('popup');
        expect(second.component).toBe(AuditLogsContentView);
        expect(second.properties.objectIds).toEqual(['second-object']);
        expect(toRaw(second.properties.customRenderers)).toBe(customRenderers);
        expect(second.properties.openLogs).toBe(openLogs);
        expect(content.props('objectIds')).toEqual(['initial-object']);
        expect(present).toHaveBeenCalledTimes(2);
    }
    finally {
        wrapper.unmount();
    }
});
