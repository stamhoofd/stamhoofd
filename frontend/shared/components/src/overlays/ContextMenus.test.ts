/* eslint-disable vue/one-component-per-file */
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { SortItemDirection } from '@stamhoofd/structures';
import { page, userEvent } from 'vitest/browser';
import { defineComponent, nextTick, ref } from 'vue';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import TestAppWithModalStackComponent from '../../tests/helpers/TestAppWithModalStackComponent.vue';

import { Column } from '../tables/classes/Column';
import { AsyncTableAction } from '../tables/classes/TableAction';
import ColumnSelectorContextMenu from '../tables/ColumnSelectorContextMenu.vue';
import ColumnSortingContextMenu from '../tables/ColumnSortingContextMenu.vue';
import TableActionsContextMenu from '../tables/TableActionsContextMenu.vue';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import ContextMenuItemView from './ContextMenuItemView.vue';
import ContextMenuLine from './ContextMenuLine.vue';
import ContextMenuView from './ContextMenuView.vue';
import GeneralContextMenuView from './GeneralContextMenuView.vue';

const navigationProvide = {
    reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
    reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
};

function createColumn(name: string, index: number, options: { enabled?: boolean; allowSorting?: boolean } = {}) {
    return new Column({
        name,
        index,
        enabled: options.enabled,
        allowSorting: options.allowSorting,
        getValue: () => name,
    });
}

function getMenuItems(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="context-menu-item"]'));
}

function renderWithNavigation(component: any, props: Record<string, unknown> = {}) {
    return render(component, {
        props,
        global: {
            provide: navigationProvide,
            config: {
                globalProperties: {
                    $isMobile: false,
                    $t: (value: string) => value,
                } as any,
            },
            directives: {
                tooltip: {},
            },
        },
    });
}

test('ContextMenuLine renders the separator', () => {
    render(ContextMenuLine);
    expect(document.querySelector('hr.context-menu-line')).not.toBeNull();
});

test('ContextMenuView positions the menu and dismisses on backdrop click', async () => {
    const pop = vi.fn().mockResolvedValue(undefined);
    render(ContextMenuView, {
        props: {
            x: 40,
            y: 50,
            preferredWidth: 240,
        },
        global: {
            provide: {
                reactive_navigation_pop: pop,
            },
        },
        slots: {
            default: '<button class="inside">Inside</button>',
        },
    });

    const menu = document.querySelector<HTMLElement>('.context-menu')!;
    await vi.waitFor(() => {
        expect(menu.style.left).toBe('40px');
        expect(menu.style.top).toBe('50px');
        expect(menu.style.width).toBe('240px');
    });

    await userEvent.click(document.querySelector('.inside')!);
    expect(pop).not.toHaveBeenCalled();

    await userEvent.click(document.querySelector('.context-menu-container')!);
    expect(pop).toHaveBeenCalledWith({ force: true });
});

test('ContextMenuView delegates item clicks and pops after the delay', async () => {
    const pop = vi.fn().mockResolvedValue(undefined);
    const clicked = vi.fn();
    const Harness = defineComponent({
        components: { ContextMenuView, ContextMenuItemView },
        setup() {
            const contextMenu = ref<InstanceType<typeof ContextMenuView> | null>(null);
            return { contextMenu, clicked };
        },
        template: `
            <ContextMenuView ref="contextMenu">
                <ContextMenuItemView :context-menu-view="contextMenu" @click="clicked">
                    Action
                </ContextMenuItemView>
            </ContextMenuView>
        `,
    });
    render(Harness, {
        global: {
            provide: {
                reactive_navigation_pop: pop,
                reactive_navigation_present: vi.fn(),
            },
        },
    });

    await userEvent.click(getMenuItems()[0]);
    await vi.waitFor(() => expect(clicked).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(pop).toHaveBeenCalledWith({ force: true }));
});

test('ContextMenuView keeps its parent open when a consumer only pops the current menu', async () => {
    const parentPop = vi.fn();
    const Harness = defineComponent({
        components: { ContextMenuView },
        setup() {
            const menu = ref<InstanceType<typeof ContextMenuView> | null>(null);
            const parentMenu = {
                pop: parentPop,
                isPopped: false,
                el: document.body,
            };
            return { menu, parentMenu };
        },
        template: `
            <ContextMenuView ref="menu" :parent-menu="parentMenu">
                <button data-testid="pop-self" @click="menu?.pop(false)">Close menu</button>
            </ContextMenuView>
        `,
    });
    renderWithNavigation(Harness);

    await userEvent.click(document.querySelector('[data-testid="pop-self"]')!);
    expect(parentPop).not.toHaveBeenCalled();
});

test('GeneralContextMenuView renders groups and only runs enabled actions', async () => {
    const enabledAction = vi.fn();
    const disabledAction = vi.fn();
    const menu = new ContextMenu([
        [
            new ContextMenuItem({ name: 'Open', icon: 'edit', action: enabledAction }),
            new ContextMenuItem({ name: 'Unavailable', disabled: 'No access', action: disabledAction }),
        ],
        [
            new ContextMenuItem({ name: 'Delete', destructive: true, rightText: '⌫' }),
        ],
    ]);

    renderWithNavigation(GeneralContextMenuView, { menu });

    expect(getMenuItems().map(item => item.textContent?.trim())).toEqual(expect.arrayContaining([
        expect.stringContaining('Open'),
        expect.stringContaining('Unavailable'),
        expect.stringContaining('Delete'),
    ]));
    expect(document.querySelectorAll('.context-menu-line')).toHaveLength(1);
    expect(document.querySelector('.context-menu-item.destructive')).not.toBeNull();
    expect(document.querySelector('.context-menu-item.disabled')).not.toBeNull();

    await userEvent.click(getMenuItems()[0]);
    await vi.waitFor(() => expect(enabledAction).toHaveBeenCalledTimes(1));

    await userEvent.click(getMenuItems()[1]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(disabledAction).not.toHaveBeenCalled();
});

test('GeneralContextMenuView manages the focus class for its lifetime', async () => {
    const focusElement = document.createElement('button');
    document.body.append(focusElement);
    const menu = new ContextMenu([[new ContextMenuItem({ name: 'Open' })]]);
    menu.focusElement = focusElement;

    const result = renderWithNavigation(GeneralContextMenuView, { menu });
    expect(focusElement.classList.contains('focused')).toBe(true);

    await result.unmount();
    expect(focusElement.classList.contains('focused')).toBe(false);
    focusElement.remove();
});

test('ColumnSelectorContextMenu sorts columns and never disables the final column', async () => {
    const last = createColumn('Last', 2, { enabled: true });
    const first = createColumn('First', 1, { enabled: true });
    first.width = 180;
    first.renderWidth = 170;
    renderWithNavigation(ColumnSelectorContextMenu, {
        columns: [last, first],
    });

    expect(getMenuItems().map(item => item.textContent?.trim())).toEqual(['First', 'Last']);

    await userEvent.click(getMenuItems()[0]);
    await vi.waitFor(() => expect(first.enabled).toBe(false));
    expect(first.width).toBeNull();
    expect(first.renderWidth).toBeNull();

    await userEvent.click(getMenuItems()[1]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(last.enabled).toBe(true);
});

test('ColumnSortingContextMenu filters columns and toggles the active direction', async () => {
    const active = createColumn('Active', 2);
    const first = createColumn('First', 1);
    const hidden = createColumn('Hidden', 0, { allowSorting: false });
    const setSort = vi.fn();
    renderWithNavigation(ColumnSortingContextMenu, {
        columns: [active, hidden, first],
        sortBy: active,
        sortDirection: SortItemDirection.ASC,
        setSort,
    });

    expect(getMenuItems().map(item => item.textContent?.trim())).toEqual(['First', 'Active']);
    expect(document.querySelector('.arrow-up-small')).not.toBeNull();

    await userEvent.click(getMenuItems()[0]);
    await vi.waitFor(() => expect(setSort).toHaveBeenCalledWith(first, SortItemDirection.ASC));

    await userEvent.click(getMenuItems()[1]);
    await vi.waitFor(() => expect(setSort).toHaveBeenCalledWith(active, SortItemDirection.DESC));
});

test('TableActionsContextMenu filters, groups, orders, handles, and dismisses actions', async () => {
    const selection = {
        filter: {},
        fetcher: {},
        markedRows: new Map([['one', { id: 'one' }]]),
        markedRowsAreSelected: true,
    } as any;
    const highHandler = vi.fn();
    const lowHandler = vi.fn();
    const disabledHandler = vi.fn();
    const onDismiss = vi.fn();
    const actions = [
        new AsyncTableAction({ name: 'Low', groupIndex: 0, priority: 1, handler: lowHandler }),
        new AsyncTableAction({ name: 'High', groupIndex: 0, priority: 10, handler: highHandler }),
        new AsyncTableAction({ name: 'Second group', groupIndex: 2, handler: vi.fn() }),
        new AsyncTableAction({ name: 'Hidden', enabled: () => false, handler: vi.fn() }),
        new AsyncTableAction({
            name: 'Disabled',
            allowAutoSelectAll: false,
            handler: disabledHandler,
        }),
    ];
    const result = renderWithNavigation(TableActionsContextMenu, {
        actions,
        selection,
        onDismiss,
    });

    expect(getMenuItems().map(item => item.textContent?.trim())).toEqual([
        'High',
        'Low',
        'Disabled',
        'Second group',
    ]);
    expect(document.querySelectorAll('.context-menu-line')).toHaveLength(1);

    await userEvent.click(getMenuItems()[0]);
    await vi.waitFor(() => expect(highHandler).toHaveBeenCalledWith(selection));

    const emptySelection = {
        ...selection,
        markedRows: new Map(),
        markedRowsAreSelected: null,
    };
    await result.rerender({
        actions,
        selection: emptySelection,
        onDismiss,
    });
    await nextTick();
    expect(getMenuItems()[2].classList.contains('disabled')).toBe(true);
    await userEvent.click(getMenuItems()[2]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(disabledHandler).not.toHaveBeenCalled();

    await result.unmount();
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('ContextMenu supports real nested hover navigation and switching parent branches', async () => {
    await page.viewport(1000, 800);

    const deepAction = vi.fn();
    const rootAction = vi.fn();

    const fruitMenu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Direct fruit',
                action: vi.fn(),
            }),
            new ContextMenuItem({
                name: 'Citrus',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Orange',
                            action: deepAction,
                        }),
                    ],
                ]),
            }),
        ],
    ]);
    const colorMenu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Red',
                action: vi.fn(),
            }),
        ],
    ]);
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Fruit',
                childMenu: fruitMenu,
            }),
            new ContextMenuItem({
                name: 'Color',
                childMenu: colorMenu,
            }),
            new ContextMenuItem({
                name: 'Rename',
                action: rootAction,
            }),
        ],
    ]);

    const Harness = defineComponent({
        setup() {
            async function openMenu(event: MouseEvent) {
                await menu.show({ button: event.currentTarget as HTMLElement });
            }
            return { openMenu };
        },
        template: '<button data-testid="open-menu" type="button" @click="openMenu">Open menu</button>',
    });
    render(TestAppWithModalStackComponent, {
        props: {
            root: new ComponentWithProperties(Harness),
        },
        global: {
            directives: {
                tooltip: {},
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    $isMobile: false,
                } as any,
            },
        },
    });

    const openMenu = page.getByTestId('open-menu');
    const fruit = page.getByText('Fruit', { exact: true });
    const citrus = page.getByText('Citrus', { exact: true });
    const orange = page.getByText('Orange', { exact: true });
    const directFruit = page.getByText('Direct fruit', { exact: true });
    const color = page.getByText('Color', { exact: true });
    const red = page.getByText('Red', { exact: true });
    const rename = page.getByText('Rename', { exact: true });

    await openMenu.click();
    await expect.element(fruit).toBeVisible();

    await fruit.hover();
    await expect.element(citrus).toBeVisible();

    await citrus.hover();
    await expect.element(orange).toBeVisible();

    await orange.click();
    await vi.waitFor(() => expect(deepAction).toHaveBeenCalledTimes(1));
    await expect.element(fruit).not.toBeInTheDocument();

    await openMenu.click();
    await expect.element(fruit).toBeVisible();
    await fruit.hover();
    await expect.element(directFruit).toBeVisible();

    await color.hover();
    await expect.element(red).toBeVisible();
    await expect.element(directFruit).not.toBeInTheDocument();

    await rename.hover();
    await expect.element(red).not.toBeInTheDocument();

    await rename.click();
    await vi.waitFor(() => expect(rootAction).toHaveBeenCalledTimes(1));
    await expect.element(rename).not.toBeInTheDocument();
    await expect.element(fruit).not.toBeInTheDocument();
});

test('ContextMenu dismisses both the parent and open child menu after an outside click', async () => {
    await page.viewport(1000, 800);

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Parent action',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Child action',
                            action: vi.fn(),
                        }),
                    ],
                ]),
            }),
        ],
    ]);
    const Harness = defineComponent({
        setup() {
            async function openMenu(event: MouseEvent) {
                await menu.show({ button: event.currentTarget as HTMLElement });
            }
            return { openMenu };
        },
        template: '<button data-testid="open-dismiss-menu" type="button" @click="openMenu">Open dismiss menu</button>',
    });
    render(TestAppWithModalStackComponent, {
        props: {
            root: new ComponentWithProperties(Harness),
        },
        global: {
            directives: {
                tooltip: {},
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    $isMobile: false,
                } as any,
            },
        },
    });

    const parentItem = page.getByText('Parent action', { exact: true });
    const childItem = page.getByText('Child action', { exact: true });

    await page.getByTestId('open-dismiss-menu').click();
    await expect.element(parentItem).toBeVisible();
    await parentItem.hover();
    await expect.element(childItem).toBeVisible();

    const outsideMenus = document.elementFromPoint(900, 700);
    expect(outsideMenus).not.toBeNull();
    await userEvent.click(outsideMenus!);

    await expect.element(parentItem).not.toBeInTheDocument();
    await expect.element(childItem).not.toBeInTheDocument();
});
