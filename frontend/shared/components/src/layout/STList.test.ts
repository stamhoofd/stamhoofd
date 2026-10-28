import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent, h, nextTick } from 'vue';
import STList from './STList.vue';
import STListItem from './STListItem.vue';

afterEach(() => {
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true }));
});

function renderDraggableList() {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    // An .st-view has `contain`, so it is the containing block of the fixed drag ghost
    const Wrapper = defineComponent({
        setup() {
            return () => h('div', { style: { position: 'absolute', left: '200px', top: '150px', width: '400px', height: '400px', contain: 'strict' } }, [
                h(STList, { modelValue: items, draggable: true }, {
                    item: ({ item }: { item: { id: string } }) => h(STListItem, { 'data-testid': `item-${item.id}` }, {
                        default: () => item.id,
                        right: () => h('span', { 'class': 'icon drag', 'data-testid': `handle-${item.id}` }),
                    }),
                }),
            ]);
        },
    });

    return render(Wrapper);
}

test('keeps the drag ghost under the dragged item when an ancestor is the containing block', async () => {
    const screen = renderDraggableList();
    // sortablejs-vue3 creates the Sortable instance in a watcher
    await nextTick();
    const item = screen.getByTestId('item-a').element() as HTMLElement;
    const handle = screen.getByTestId('handle-a').element() as HTMLElement;

    const itemRect = item.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const x = handleRect.left + handleRect.width / 2;
    const y = handleRect.top + handleRect.height / 2;

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true, button: 0, clientX: x, clientY: y }));
    const ghost = await vi.waitFor(() => {
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, isPrimary: true, clientX: x, clientY: y + 1 }));
        const element = document.querySelector<HTMLElement>('.sortable-fallback');
        expect(element).not.toBeNull();
        return element!;
    });

    // The ghost follows the pointer through its transform; only its starting position matters here
    ghost.style.transform = 'none';
    const ghostRect = ghost.getBoundingClientRect();
    expect(ghostRect.left).toBeCloseTo(itemRect.left, 0);
    expect(ghostRect.top).toBeCloseTo(itemRect.top, 0);
});
