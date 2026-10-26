import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import PreviewOutlet from './PreviewOutlet.vue';
import PreviewPanel from './PreviewPanel.vue';

/**
 * A preview with its own state, to check it survives moving between the column and an outlet
 */
const StatefulPreview = defineComponent({
    setup() {
        const count = ref(0);
        return () => h('button', { 'type': 'button', 'data-testid': 'preview', 'onClick': () => count.value++ }, `Geklikt: ${count.value}`);
    },
});

function renderPanel({ width, outlets = 1 }: { width: number; outlets?: number }) {
    const panelWidth = ref(width);
    const outletCount = ref(outlets);

    const Wrapper = defineComponent({
        setup() {
            return () => h('div', { style: { width: `${panelWidth.value}px` } }, [
                h(PreviewPanel, null, {
                    default: ({ wide }: { wide: boolean }) => h('div', { 'data-testid': 'view', 'data-wide': String(wide) },
                        Array.from({ length: outletCount.value }, (_, i) => h('section', { 'key': i, 'data-testid': `outlet-${i}` }, [h(PreviewOutlet)])),
                    ),
                    preview: () => h(StatefulPreview),
                    actions: () => h('button', { 'type': 'button', 'data-testid': 'actions' }, 'Bevestigen'),
                }),
            ]);
        },
    });

    const screen = render(Wrapper);
    return { screen, panelWidth, outletCount };
}

function previewElement() {
    return document.querySelector<HTMLElement>('[data-testid="preview"]')!;
}

test('shows the preview and actions in their own column when the panel is at least 900px wide', async () => {
    const { screen } = renderPanel({ width: 1000 });

    await vi.waitFor(() => expect(previewElement().closest('.preview-panel-column')).not.toBeNull());
    expect(screen.getByTestId('view').element().getAttribute('data-wide')).toBe('true');
    expect(document.querySelector('.preview-panel-actions [data-testid="actions"]')).not.toBeNull();
    expect(previewElement().closest('.preview-outlet')).toBeNull();
});

test('moves the preview to the outlet of the view on narrow panels, without the actions', async () => {
    const { screen } = renderPanel({ width: 600 });

    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-0"]')).not.toBeNull());
    expect(screen.getByTestId('view').element().getAttribute('data-wide')).toBe('false');
    expect(document.querySelector('[data-testid="actions"]')).toBeNull();
});

test('hides the preview on narrow panels when the view has no outlet', async () => {
    renderPanel({ width: 600, outlets: 0 });

    await vi.waitFor(() => expect(previewElement()).not.toBeNull());
    expect(previewElement().closest('.preview-panel-parking')).not.toBeNull();
    expect(previewElement().offsetParent).toBeNull();
});

test('the most recent outlet takes over the preview, and returns it when it is removed', async () => {
    const { outletCount } = renderPanel({ width: 600, outlets: 1 });
    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-0"]')).not.toBeNull());

    outletCount.value = 2;
    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-1"]')).not.toBeNull());

    outletCount.value = 1;
    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-0"]')).not.toBeNull());
});

test('keeps the state of the preview while it moves between the column and the outlet', async () => {
    const { screen, panelWidth } = renderPanel({ width: 1000 });
    await vi.waitFor(() => expect(previewElement().closest('.preview-panel-column')).not.toBeNull());

    await screen.getByTestId('preview').click();
    await screen.getByTestId('preview').click();
    const element = previewElement();
    expect(element.textContent).toBe('Geklikt: 2');

    panelWidth.value = 600;
    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-0"]')).not.toBeNull());
    expect(previewElement()).toBe(element);
    expect(element.textContent).toBe('Geklikt: 2');

    panelWidth.value = 1000;
    await vi.waitFor(() => expect(previewElement().closest('.preview-panel-column')).not.toBeNull());
    expect(previewElement()).toBe(element);
    expect(element.textContent).toBe('Geklikt: 2');
});

test('keeps the preview in the outlet when the whole panel is deactivated, so the view keeps its height while it animates out', async () => {
    const showPanel = ref(true);
    const Panel = defineComponent({
        name: 'Panel',
        setup() {
            return () => h('div', { style: { width: '600px' } }, [
                h(PreviewPanel, null, {
                    default: () => h('section', { 'data-testid': 'outlet-0' }, [h(PreviewOutlet)]),
                    preview: () => h(StatefulPreview),
                }),
            ]);
        },
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => h('p', 'Andere view') });

    // Like a navigation controller: the view is kept alive (deactivated) when another view is pushed
    render(defineComponent({
        setup() {
            return () => h(KeepAlive, null, [showPanel.value ? h(Panel) : h(Other)]);
        },
    }));
    await vi.waitFor(() => expect(previewElement().closest('[data-testid="outlet-0"]')).not.toBeNull());
    const element = previewElement();

    showPanel.value = false;
    await nextTick();
    await nextTick();
    expect(element.closest('[data-testid="outlet-0"]')).not.toBeNull();

    showPanel.value = true;
    await vi.waitFor(() => expect(previewElement()?.closest('[data-testid="outlet-0"]')).not.toBeNull());
    expect(previewElement()).toBe(element);
});
