import { AuditLog, AuditLogReplacementType, AuditLogSource, AuditLogType, NamedObject } from '@stamhoofd/structures';
import { mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { ContextMenu } from '../../overlays/ContextMenu.ts';
import AuditLogRow from './AuditLogRow.vue';
import type { AuditLogCustomRenderers } from './RenderTextComponent.ts';

afterEach(() => {
    vi.restoreAllMocks();
});

function mountRow(objectId: string | null, canFilter = true, customRenderers?: AuditLogCustomRenderers) {
    const openLogs = vi.fn<(objectId: string) => Promise<void>>().mockResolvedValue(undefined);
    const wrapper = mount(AuditLogRow, {
        props: {
            log: AuditLog.create({
                objectId,
                description: 'Audit entry',
                createdAt: new Date(),
                type: AuditLogType.Unknown,
                source: AuditLogSource.User,
                user: NamedObject.create({ id: 'user-id', name: 'Original user' }),
                replacements: new Map(),
            }),
            canFilter,
            openLogs,
            customRenderers,
        },
        global: {
            stubs: {
                STListItem: defineComponent({
                    setup(_, { slots }) {
                        return () => h('div', slots.default?.());
                    },
                }),
                IconContainer: true,
                ProgressIcon: true,
                PatchListText: true,
            },
        },
    });
    return { wrapper, openLogs };
}

test('the context menu opens logs for the selected object through the supplied callback', async () => {
    const show = vi.spyOn(ContextMenu.prototype, 'show').mockImplementation(async function (this: ContextMenu) { return this; });
    const { wrapper, openLogs } = mountRow('selected-object');
    try {
        expect(wrapper.text()).toContain('Audit entry');
        await wrapper.trigger('contextmenu');
        expect(show).toHaveBeenCalledOnce();
        expect(openLogs).not.toHaveBeenCalled();
        const menu = show.mock.contexts[0] as ContextMenu;
        const item = menu.items[0][0];
        expect(item.action).not.toBeNull();
        await item.action!.call(item);
        expect(openLogs).toHaveBeenCalledExactlyOnceWith('selected-object');
    }
    finally {
        wrapper.unmount();
    }
});

test('keeps custom actor rendering alongside the original audit description', () => {
    const { wrapper } = mountRow('selected-object', true, {
        [AuditLogReplacementType.User]: user => () => `Custom actor: ${user.value}`,
    });
    try {
        expect(wrapper.text()).toContain('Audit entry');
        expect(wrapper.text()).toContain('Custom actor: Original user');
    }
    finally {
        wrapper.unmount();
    }
});

test.each([
    { objectId: null, canFilter: true },
    { objectId: 'selected-object', canFilter: false },
])('does not offer object navigation for $objectId with canFilter=$canFilter', async ({ objectId, canFilter }) => {
    const show = vi.spyOn(ContextMenu.prototype, 'show').mockImplementation(async function (this: ContextMenu) { return this; });
    const { wrapper, openLogs } = mountRow(objectId, canFilter);
    try {
        await wrapper.trigger('contextmenu');
        expect(show).not.toHaveBeenCalled();
        expect(openLogs).not.toHaveBeenCalled();
    }
    finally {
        wrapper.unmount();
    }
});
