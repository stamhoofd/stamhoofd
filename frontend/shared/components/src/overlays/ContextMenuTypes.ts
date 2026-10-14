import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { markRaw } from 'vue';

export interface ContextMenuLike {
    items: ContextMenuItem[][];
    getComponent(): ComponentWithProperties;
}

export interface ContextMenuViewState extends ContextMenuLike {
    focusElement: HTMLElement | null;
}

export class ContextMenuItem {
    name: string;
    description?: string;

    rightText: string | null = null;
    icon: string | null = null;

    /**
     * Shows a checkbox on the left if true/false.
     * You can  alter the selected value in action() to adjust it.
     */
    selected: boolean | null = null;
    disabled: boolean | string = false;
    destructive = false;

    /**
     * Called with this item as `this`. The menu closes after a leaf click;
     * return values are ignored and returned promises are not awaited by the view.
     */
    action: ((this: ContextMenuItem) => unknown | Promise<void>) | null = null;

    /**
     * Context menu to show when hovered
     */
    childMenu: ContextMenuLike | null = null;

    constructor(settings: Partial<ContextMenuItem>) {
        markRaw(this);
        Object.assign(this, settings);
    }
}
