import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { useCurrentComponent } from '@simonbackx/vue-app-navigation';
import type { InjectionKey, Ref, ShallowRef } from 'vue';
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, provide, ref, shallowReactive, shallowRef, watch } from 'vue';

type PreviewPanelContext = {
    outlets: ShallowRef<HTMLElement[]>;
    /** False while the panel itself is deactivated, e.g. when a view is pushed on top of the view with the panel */
    active: Ref<boolean>;
};

const previewPanelKey = Symbol('PreviewPanel') as InjectionKey<PreviewPanelContext>;
const columnWidthsKey = Symbol('PreviewColumnWidths') as InjectionKey<Map<ComponentWithProperties, number>>;

/**
 * Lets the views inside a PreviewPanel offer a place for the preview, used when the preview does not fit next to them.
 * The most recently mounted or activated outlet wins, so a pushed view takes over the preview from the view below it.
 */
export function useProvidePreviewPanel() {
    const outlets = shallowRef<HTMLElement[]>([]);
    const active = ref(true);
    onActivated(() => {
        active.value = true;
    });
    onDeactivated(() => {
        active.value = false;
    });
    provide(previewPanelKey, { outlets, active });

    return {
        outlet: computed(() => outlets.value.at(-1) ?? null),
    };
}

/**
 * Registers the element as the place for the preview of the surrounding PreviewPanel.
 * Returns false when the component is not inside a PreviewPanel.
 */
export function usePreviewOutlet(element: Readonly<Ref<HTMLElement | null>>): boolean {
    const context = inject(previewPanelKey, null);
    if (!context) {
        return false;
    }
    const { outlets, active } = context;

    let registered: HTMLElement | null = null;

    function unregister() {
        if (registered) {
            const el = registered;
            outlets.value = outlets.value.filter(o => o !== el);
            registered = null;
        }
    }

    function register() {
        unregister();
        if (element.value) {
            registered = element.value;
            outlets.value = [...outlets.value, registered];
        }
    }

    let outletActive = true;

    onMounted(register);
    onActivated(() => {
        outletActive = true;
        register();
    });
    onDeactivated(() => {
        outletActive = false;
        // Only when a view inside the panel is pushed over this outlet. When the whole panel is deactivated, the outlet
        // keeps the preview: moving it away would shrink the view (and reset its scroll position) while it animates out.
        // Checked after the deactivated hooks of the panel ran.
        nextTick(() => {
            if (!outletActive && active.value) {
                unregister();
            }
        }).catch(console.error);
    });
    onBeforeUnmount(unregister);

    return true;
}

/**
 * Lets a container around a navigation controller follow the width of the preview column of each of its views,
 * e.g. to keep its own content above the views clear of that column. The width is 0 while the preview has no column.
 */
export function useProvidePreviewColumnWidths() {
    const widths = shallowReactive(new Map<ComponentWithProperties, number>());
    provide(columnWidthsKey, widths);
    return widths;
}

/**
 * Reports the width of the preview column for the view this PreviewPanel is part of (see useProvidePreviewColumnWidths)
 */
export function useReportPreviewColumnWidth(width: Readonly<Ref<number>>) {
    const widths = inject(columnWidthsKey, null);
    const component = useCurrentComponent();
    if (!widths || !component) {
        return;
    }
    watch(width, value => widths.set(component, value), { immediate: true });
    onBeforeUnmount(() => widths.delete(component));
}
