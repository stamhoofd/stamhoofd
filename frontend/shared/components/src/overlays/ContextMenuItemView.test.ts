import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';

import ContextMenuItemView from './ContextMenuItemView.vue';

function createContextMenuView() {
    return {
        childMenu: null as any,
        onHoverItem: vi.fn(),
        onMouseLeaveItem: vi.fn(),
        onClickItem: vi.fn(),
    };
}

test('renders as a button with all slots by default', () => {
    const contextMenuView = createContextMenuView();
    render(ContextMenuItemView, {
        props: { contextMenuView },
        slots: {
            left: '<span data-testid="left">Left</span>',
            default: '<span data-testid="middle">Middle</span>',
            right: '<span data-testid="right">Right</span>',
        },
    });

    const item = document.querySelector<HTMLElement>('[data-testid="context-menu-item"]')!;
    expect(item.tagName).toBe('BUTTON');
    expect(item.getAttribute('type')).toBe('button');
    expect(item.textContent).toContain('Left');
    expect(item.textContent).toContain('Middle');
    expect(item.textContent).toContain('Right');
});

test('supports label elements and custom classes', () => {
    render(ContextMenuItemView, {
        props: {
            contextMenuView: createContextMenuView(),
            elementName: 'label',
            class: ['destructive', { disabled: true }],
        },
    });

    const item = document.querySelector<HTMLElement>('[data-testid="context-menu-item"]')!;
    expect(item.tagName).toBe('LABEL');
    expect(item.classList.contains('destructive')).toBe(true);
    expect(item.classList.contains('disabled')).toBe(true);
});

test('passes a stable public item API to hover and click handlers', async () => {
    const contextMenuView = createContextMenuView();
    render(ContextMenuItemView, {
        props: { contextMenuView },
    });
    const item = document.querySelector<HTMLElement>('[data-testid="context-menu-item"]')!;

    item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(contextMenuView.onHoverItem).toHaveBeenCalledTimes(1);
    const itemApi = contextMenuView.onHoverItem.mock.calls[0][0];
    expect(itemApi.el).toBe(item);
    expect(itemApi.isHovered).toBe(false);

    itemApi.isHovered = true;
    await nextTick();
    expect(item.classList.contains('hover')).toBe(true);

    item.dispatchEvent(new MouseEvent('mouseleave'));
    expect(contextMenuView.onMouseLeaveItem).toHaveBeenCalledWith(itemApi);

    await userEvent.click(item);
    expect(contextMenuView.onClickItem).toHaveBeenCalledWith(itemApi, expect.any(MouseEvent));
});

test('marks the item open when its child menu is active', async () => {
    const childMenu = {};
    const contextMenuView = createContextMenuView();
    contextMenuView.childMenu = childMenu;

    render(ContextMenuItemView, {
        props: {
            contextMenuView,
            childContextMenu: childMenu as any,
        },
    });

    expect(document.querySelector('.context-menu-item.isOpen')).not.toBeNull();
});
