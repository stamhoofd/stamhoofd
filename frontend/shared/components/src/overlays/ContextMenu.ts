import type { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

import GeneralContextMenuView from './GeneralContextMenuView.vue';
import { ModalStackEventBus } from './ModalStackEventBus';
import { markRaw } from 'vue';
import { ContextMenuItem } from './ContextMenuTypes';
import type { ContextMenuLike } from './ContextMenuTypes';

export { ContextMenuItem } from './ContextMenuTypes';

export class ContextMenu implements ContextMenuLike {
    /**
     * Prevent the default behaviour of click on the item, e.g. to keep the focus on an input element
     */
    preventDefault = false;

    focusElement: HTMLElement | null = null;

    items: ContextMenuItem[][];

    constructor(items: ContextMenuItem[][]) {
        markRaw(this);
        this.items = items.filter(i => i.length > 0);
    }

    getComponent() {
        return new ComponentWithProperties(GeneralContextMenuView, { menu: this });
    }

    async show(position: { component?: typeof NavigationMixin; clickEvent?: TouchEvent | MouseEvent; button?: HTMLElement; x?: number; y?: number; xPlacement?: 'right' | 'left'; yPlacement?: 'bottom' | 'top'; wrapWidth?: number; wrapHeight?: number; yOffset?: number; xOffset?: number }) {
        if (position.button) {
            const bounds = position.button.getBoundingClientRect();

            if (!position.xPlacement || position.xPlacement === 'right') {
                position.x = bounds.left;
            } else {
                position.x = bounds.right;
            }

            if (!position.yPlacement || position.yPlacement === 'bottom') {
                position.y = bounds.bottom;
            } else {
                position.y = bounds.top;
            }

            position.wrapWidth = bounds.width;
            position.wrapHeight = bounds.height;
        }

        if (position.clickEvent) {
            const event = position.clickEvent as any;
            position.x = event.changedTouches ? event.changedTouches[0].pageX : event.clientX;
            position.y = event.changedTouches ? event.changedTouches[0].pageY : event.clientY;
        }

        if (position.y !== undefined && position.yOffset) {
            position.y += position.yOffset;
        }

        if (position.x !== undefined && position.xOffset) {
            position.x += position.xOffset;
        }

        const component = position.component;
        delete position.component;

        if (position.button) {
            this.focusElement = position.button;
        } else {
            if (position.clickEvent?.currentTarget) {
                this.focusElement = (position.clickEvent?.currentTarget as HTMLElement) ?? null;
            }
        }

        const menuComponent = new ComponentWithProperties(GeneralContextMenuView, {
            menu: this,
            ...position,
        });
        if (component) {
            component.present({
                components: [menuComponent],
                modalDisplayStyle: 'overlay',
            });
        } else {
            await ModalStackEventBus.sendEvent('present', {
                components: [menuComponent],
                modalDisplayStyle: 'overlay',
            });
        }
        return this;
    }
}
