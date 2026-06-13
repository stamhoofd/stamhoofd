<template>
    <div ref="containerEl" class="context-menu-container" :class="{ hasParent: !!parentMenu, disableDismiss: !autoDismiss }" @click="pop()" @contextmenu.prevent>
        <div
            ref="context"
            class="context-menu"
            :class="usedXPlacement+' '+usedYPlacement"
            :style="{ transformOrigin, top: top !== null ? top + 'px' : undefined, left: left !== null ? (left + 'px') : undefined, right: right !== null ? (right + 'px') : undefined, bottom: bottom !== null ? (bottom + 'px') : undefined, width: usedPreferredWidth !== null ? (usedPreferredWidth + 'px') : undefined, height: usedPreferredHeight !== null ? (usedPreferredHeight + 'px') : undefined }"
            @click.stop=""
        >
            <slot />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { usePop } from '@simonbackx/vue-app-navigation';
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useTemplateRef } from 'vue';

import { ViewportHelper } from '../ViewportHelper';
import type { ContextMenuItemApi } from './ContextMenuItemView.vue';

/**
 * The public surface a parent ContextMenuView exposes to its child menus.
 */
interface ParentMenuApi {
    pop: (popParents?: boolean) => Promise<void>;
    isPopped: boolean;
    el: HTMLElement | null;
}

function triangleContains(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, x: number, y: number) {
    const det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    return det * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) >= 0
        && det * ((cx - bx) * (y - by) - (cy - by) * (x - bx)) >= 0
        && det * ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) >= 0;
}

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(defineProps<{
    x?: number;
    preferredWidth?: number | null;
    y?: number;
    xPlacement?: 'right' | 'left';
    yPlacement?: 'bottom' | 'top';
    parentMenu?: ParentMenuApi | null;
    /**
     * In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapWidth (needed for e.g. context menu's)
     */
    wrapWidth?: number | null;
    /**
     * In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapHeight (needed for e.g. context menu's)
     */
    wrapHeight?: number | null;
    autoDismiss?: boolean;
}>(), {
    x: 0,
    preferredWidth: null,
    y: 0,
    xPlacement: 'right',
    yPlacement: 'bottom',
    parentMenu: null,
    wrapWidth: null,
    wrapHeight: null,
    autoDismiss: true,
});

const parentPop = usePop();

const containerEl = useTemplateRef<HTMLElement>('containerEl');
const context = useTemplateRef<HTMLElement>('context');

const usedPreferredHeight = ref<number | null>(null);
const usedPreferredWidth = ref<number | null>(props.preferredWidth);
const hide = ref(false);

const top = ref<number | null>(null);
const left = ref<number | null>(null);
const right = ref<number | null>(null);
const bottom = ref<number | null>(null);

const transformOrigin = ref('0 0');

const usedXPlacement = ref<'right' | 'left'>(props.xPlacement);
const usedYPlacement = ref<'bottom' | 'top'>(props.yPlacement);

const isPopped = ref(false);
const childMenu = ref<ComponentWithProperties | null>(null);

let disableHoverChildMenus = false;
let currentlyHoveredItem: ContextMenuItemApi | null = null;

// When we hover an item that has a child menu, we need to cancel other hovers if the mouse moves to the child menu
let ignoreHover = false;
let ignoreHoverItem: ContextMenuItemApi | null = null;
let ignoreHoverTimeout: NodeJS.Timeout | null = null;
let ignoreHoverTriangle: { p1: { x: number; y: number }; p2: { x: number; y: number }; p3: { x: number; y: number } } | null = null;
let hoverTimeout: NodeJS.Timeout | null = null;

onMounted(() => {
    // Calculate position
    let width = context.value!.offsetWidth;
    let height = context.value!.offsetHeight;

    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName('body')[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
        clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

    const viewPadding = 15;
    const viewPaddingBottom = Math.max(clientHeight < 900 ? 5 : 15, ViewportHelper.getBottomPadding());
    const viewPaddingTop = clientHeight < 900 ? 5 : 15;

    if (width > clientWidth - viewPadding * 2) {
        usedPreferredWidth.value = clientWidth - viewPadding * 2;
        width = usedPreferredWidth.value;
    }

    if (height > clientHeight - viewPaddingTop - viewPaddingBottom) {
        usedPreferredHeight.value = clientHeight - viewPaddingTop - viewPaddingBottom;
        height = usedPreferredHeight.value;
    }

    if (width > clientWidth / 2) {
        // Screen is too small to fit multiple context menus
        disableHoverChildMenus = true;
    }

    let usedX = props.x;

    if (props.xPlacement === 'right') {
        left.value = props.x;

        // If the remaining space is too small, we need to wrap
        if (width > clientWidth - viewPadding - props.x) {
            left.value = null;
            usedXPlacement.value = 'left';

            if (props.wrapWidth !== null) {
                // Wrap instead of sticking to right
                usedX = usedX - props.wrapWidth;
                right.value = Math.min(clientWidth - usedX, clientWidth - viewPadding - width);

                if (right.value < viewPadding) {
                    right.value = viewPadding;
                }
            } else {
                right.value = viewPadding;
            }
        } else {
            if (left.value < viewPadding) {
                left.value = viewPadding;
            }
        }
        // - Math.max(0, width - (clientWidth - viewPadding - usedX);
    } else {
        right.value = Math.min(clientWidth - usedX, clientWidth - viewPadding - width);

        if (right.value < viewPadding) {
            right.value = viewPadding;
        }
    }

    let usedY = props.y;

    if (props.yPlacement === 'bottom') {
        top.value = props.y;// - Math.max(0, height - (clientHeight - viewPadding - props.y)); // remove border

        // If the remaining space is too small, we need to wrap
        if (height > clientHeight - viewPaddingBottom - props.y) {
            top.value = null;
            usedYPlacement.value = 'top';

            if (props.wrapHeight !== null && height <= usedY - props.wrapHeight - viewPaddingTop) {
                // Wrap instead of sticking to bottom
                usedY = usedY - props.wrapHeight;
                bottom.value = Math.min(clientHeight - usedY, clientHeight - viewPaddingTop - height);

                if (bottom.value < viewPaddingBottom) {
                    bottom.value = viewPaddingBottom;
                }
            } else {
                bottom.value = viewPaddingBottom;
            }
        } else {
            if (top.value < viewPaddingTop) {
                top.value = viewPaddingTop;
            }
        }
    } else {
        bottom.value = Math.min(clientHeight - usedY, clientHeight - viewPaddingTop - height); // remove border

        if (bottom.value < viewPaddingBottom) {
            bottom.value = viewPaddingBottom;
        }
    }

    const objLeft = left.value ? left.value : (clientWidth - right.value! - width);
    const xTransform = ((usedX - objLeft) / width * 100).toFixed(2);

    const objTop = top.value ? top.value : (clientHeight - bottom.value! - height);
    const yTransform = ((usedY - objTop) / height * 100).toFixed(2);

    transformOrigin.value = xTransform + '% ' + yTransform + '%';

    if (!usedPreferredHeight.value) {
        // Only assign drag selectors if we actually  have context items
        if (context.value!.querySelector('.context-menu-item')) {
            // Allow scrolling if height is restricted, else add touch listeners to allow selection by dragging
            window.addEventListener('touchstart', onTouchStart, { passive: false });
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchUp, { passive: false });
        }
    }

    if (isPopped.value || props.parentMenu?.isPopped || (props.parentMenu && (!props.parentMenu.el || !props.parentMenu.el.isConnected))) {
        // Pop was dismissed before we could mount this context menu
        console.error('Context menu lost its parent menu during mounting');
        pop(false).catch(console.error);
    }
});

onBeforeUnmount(() => {
    popChildMenu().catch(console.error);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchUp);
});

async function popChildMenu() {
    if (childMenu.value) {
        const instance = childMenu.value.componentInstance() as any;

        if (instance) {
            console.log('Pop child menu');
            await instance.pop(false);
        } else (
            console.warn('Missing instance for childMenu')
        );
    }
    childMenu.value = null;
}

function delayHover(ms: number) {
    ignoreHover = true;
    if (ignoreHoverTimeout) {
        clearTimeout(ignoreHoverTimeout);
    }

    if (ms <= 0) {
        if (currentlyHoveredItem && ignoreHoverItem === currentlyHoveredItem) {
            // Ignore, and wait for next timer
            return;
        }
        endIgnoreHover();
        return;
    }
    ignoreHoverTimeout = setTimeout(() => {
        if (currentlyHoveredItem && ignoreHoverItem === currentlyHoveredItem) {
            // Ignore, and wait for next timer
            return;
        }
        endIgnoreHover();
    }, ms);
}

function endIgnoreHover() {
    ignoreHover = false;

    // Remove listener
    window.removeEventListener('mousemove', onMouseMove);

    ignoreHoverTriangle = null;

    const item = ignoreHoverItem;
    ignoreHoverItem = null;

    if (isPopped.value) {
        return;
    }

    // Execute mouseover again: if we are above a different context menu item: close the popup and/or open a new one
    if (currentlyHoveredItem && currentlyHoveredItem !== item) {
        onHoverItem(currentlyHoveredItem);
    }
}

function onHoverItem(item: ContextMenuItemApi) {
    currentlyHoveredItem = item;

    if (shouldIgnoreHover()) {
        return;
    }

    // Update hover style
    const wasHovered = item.isHovered;
    item.isHovered = true;

    if (disableHoverChildMenus) {
        // Never automatically show a child menu
        return;
    }

    if (!wasHovered && hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }

    if (item.childContextMenu) {
        if (!wasHovered) {
            setChildMenu(null).catch(console.error);
            hoverTimeout = setTimeout(() => {
                if (item.isHovered && currentlyHoveredItem === item && !shouldIgnoreHover() && item.childContextMenu && !item.childContextMenu.componentInstance()) {
                    // TODO: Wait x ms hover delay, and check is the cursor is still hovered

                    if (isPopped.value) {
                        return;
                    }
                    // Present child context menu + send close event to parent
                    const el = item.el as HTMLElement;

                    if (el.classList.contains('disabled')) {
                        return;
                    }
                    const bounds = el.getBoundingClientRect();

                    item.childContextMenu.properties.x = bounds.right;
                    item.childContextMenu.properties.y = bounds.top;
                    item.childContextMenu.properties.xPlacement = 'right';
                    item.childContextMenu.properties.yPlacement = 'bottom';
                    item.childContextMenu.properties.parentMenu = selfApi;
                    item.childContextMenu.properties.wrapWidth = el.clientWidth;

                    setChildMenu(item.childContextMenu as ComponentWithProperties).catch(console.error);
                    item.present(item.childContextMenu.setDisplayStyle('overlay'));
                }
            }, 150);
        }
    } else {
        setChildMenu(null).catch(console.error);
    }
}

function onMouseLeaveItem(item: ContextMenuItemApi) {
    if (currentlyHoveredItem === item) {
        currentlyHoveredItem = null;

        if (item === ignoreHoverItem) {
            delayHover(50);
        }
    }

    // Update hover style if changed
    item.isHovered = false;
}

function onClickItem(item: ContextMenuItemApi, event: Event) {
    if (item.clicked) {
        return;
    }
    item.clicked = true;

    if (item.childContextMenu) {
        // No click actions
        if (disableHoverChildMenus || (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0))) {
            // Show child menu and replace self

            if (!item.childContextMenu.componentInstance() && !shouldIgnoreHover()) {
                pop(true).catch(console.error);

                // Present child context menu + send close event to parent
                const el = item.el as HTMLElement;
                const bounds = el.getBoundingClientRect();

                // TODO: calculate better position
                item.childContextMenu.properties.x = bounds.left;
                item.childContextMenu.properties.y = bounds.top;
                item.childContextMenu.properties.xPlacement = 'right';
                item.childContextMenu.properties.yPlacement = 'bottom';
                item.childContextMenu.properties.parentMenu = null;
                item.present(item.childContextMenu.setDisplayStyle('overlay'));
            }
        }
        return;
    }

    // We need to delay click events because otherwise for some unknown reason, it would trigger again on a 'popup' and close it immediately
    setTimeout(() => {
        item.emitClick(event);
    }, 10);

    // Wait to pop to let the browser handle events (e.g. label > checkbox)
    delayPop(true);
}

async function setChildMenu(component: ComponentWithProperties | null) {
    if (childMenu.value === component) {
        return;
    }

    await popChildMenu();
    childMenu.value = component;

    // Capture initial mouse X + Y Position,
    // calculate the triangle in which region we shouldn't hover
    // keep adjusting the triangle as the mouse moves, but if the mouse stops too long, stop

    if (component && currentlyHoveredItem && !ignoreHoverItem) {
        // If the cursor now moves to the newly created context menu, we'll add a delay and prevent any other context menu hovering
        ignoreHoverItem = currentlyHoveredItem;

        // We cant calculate the triangle yet, because the child menu is not yet mounted
        ignoreHoverTriangle = null;
        delayHover(50);
        window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
}

function calculateHoverTriangle(mouseX: number, mouseY: number) {
    if (!childMenu.value) {
        return;
    }
    const instance = childMenu.value.componentInstance();
    if (!instance) {
        return;
    }

    // Get the child element, since the main element covers the whole window
    const element = instance.$el.childNodes[0] as HTMLElement;

    if (!element) {
        return;
    }

    const bounds = element.getBoundingClientRect();

    const contextX = bounds.left;
    const contextY = bounds.top;
    const contextY2 = bounds.bottom;
    const contextX2 = bounds.right;

    if (contextX < mouseX) {
        // Menu is on the left side

        return {
            p1: { x: mouseX + 5, y: mouseY },
            p2: { x: contextX2, y: contextY },
            p3: { x: contextX2, y: contextY2 },
        };
    } else {
        return {
            p1: { x: mouseX - 5, y: mouseY },
            p2: { x: contextX, y: contextY },
            p3: { x: contextX, y: contextY2 },
        };
    }
}

function updateHoverTriangle(mouseX: number, mouseY: number) {
    const triangle = calculateHoverTriangle(mouseX, mouseY);
    if (triangle) {
        ignoreHoverTriangle = triangle;
    }
}

function shouldIgnoreHover() {
    return isPopped.value || (
        childMenu.value && (
            ignoreHover
        )
    );
}

function onMouseMove(event: MouseEvent) {
    if (!childMenu.value) {
        // Wait for timer to end
        return;
    }

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const isStillHovered = currentlyHoveredItem && currentlyHoveredItem === ignoreHoverItem;

    if (ignoreHoverTriangle === null || isStillHovered) {
        // We don't have triangle yet, probably because we didn't yet have the position
        // of the mouse and the context menu

        // Just update the triangle for now, but don't expand the delay

        updateHoverTriangle(mouseX, mouseY);

        return;
    }

    // Check if mouse position is inside the triangle

    const p1 = ignoreHoverTriangle.p1;
    const p2 = ignoreHoverTriangle.p2;
    const p3 = ignoreHoverTriangle.p3;

    if (!triangleContains(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, mouseX, mouseY)) {
        // Outside triangle:
        // stop delay if we aren't hovering any longer
        delayHover(0);
        return;
    }

    // Mouse is inside the triangle
    // Expand

    delayHover(50);

    // TODO: adjust triangle

    // if X position got closer, then we'll adjust the triangle again
    const triangle = calculateHoverTriangle(mouseX, mouseY);
    if (triangle && Math.abs(p1.x - p2.x) > Math.abs(triangle.p1.x - triangle.p2.x)) {
        ignoreHoverTriangle = triangle;
    }
}

function getSelectedElementAt(x: number, y: number): HTMLElement | null {
    // Check which one is hovered, and manually add a hover state to it
    let selectedElement = document.elementFromPoint(x, y);

    // Get parent until class is context-menu-item or stop when parent is document, or context-menu-container class
    while (selectedElement && !selectedElement.classList.contains('context-menu-item') && !selectedElement.classList.contains('context-menu-container')) {
        selectedElement = selectedElement.parentElement;
    }
    if (selectedElement && selectedElement.classList.contains('context-menu-item')) {
        return selectedElement as HTMLElement;
    }
    return null;
}

function getSelectedElement(event: TouchEvent): HTMLElement | null {
    // Check which one is hovered, and manually add a hover state to it
    return getSelectedElementAt(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
}

function isInsideMenu(x: number, y: number): boolean {
    // Check which one is hovered, and manually add a hover state to it
    const selectedElement = document.elementFromPoint(x, y);

    if (selectedElement && selectedElement.closest('.context-menu')) {
        return true;
    }

    return false;
}

function isEventInsideMenu(event: TouchEvent): boolean {
    // Check which one is hovered, and manually add a hover state to it
    return isInsideMenu(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
}

function onTouchMove(event: TouchEvent) {
    // Check which one is hovered, and manually add a hover state to it
    const selectedElement = getSelectedElement(event);

    containerEl.value!.querySelectorAll('.context-menu-item').forEach((item) => {
        item.classList.remove('hover');
        item.classList.add('disable-active');
    });

    if (selectedElement) {
        selectedElement.classList.add('hover');
    }

    event.preventDefault();
}

function onTouchStart(event: TouchEvent) {
    if (!isEventInsideMenu(event)) {
        // Allow to trigger 'click' to close the context menu
        return;
    }
    event.preventDefault();
}

function onTouchUp(event: TouchEvent) {
    if (isPopped.value) {
        // We're already popped, so we don't need to do anything
        return;
    }

    const selectedElement = getSelectedElement(event);
    if (selectedElement) {
        // Prevent the touch up event from triggering a click event later
        event.preventDefault();

        // Add a delay because the browser otherwise will trigger a click event on possible child menus
        setTimeout(() => {
            selectedElement.click();
        }, 50);
    }
}

function delayPop(popParents = false) {
    if (isPopped.value) {
        // Ignore
        return;
    }

    isPopped.value = true;

    // Allow some time to let the browser handle some events (e.g. label > update checkbox)
    setTimeout(() => {
        // set isPopped to false again, to force pop
        isPopped.value = false;
        pop(popParents).catch(console.error);
    }, 80);
}

async function pop(popParents = false) {
    if (isPopped.value || hide.value) {
        // Ignore
        return;
    }
    console.log('Popping ContextMenuView');
    isPopped.value = true;
    await popChildMenu();

    // Trigger hide animation
    hide.value = true;
    // setTimeout(() => {
    await parentPop({ force: true });
    // }, 200);

    if (popParents && props.parentMenu) {
        await props.parentMenu.pop(true);
    }
}

function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) {
        return;
    }

    const key = event.key || event.keyCode;

    if (key === 'Escape' || key === 'Esc' || key === 27) {
        pop(true).catch(console.error);
        event.preventDefault();
    }
}

onActivated(() => {
    document.addEventListener('keydown', onKey);
});

onDeactivated(() => {
    document.removeEventListener('keydown', onKey);
});

// The public surface exposed to child menus (as parentMenu) and to consumers
// holding a ref to this component.
const selfApi: ParentMenuApi = {
    pop,
    get isPopped() {
        return isPopped.value;
    },
    get el() {
        return containerEl.value;
    },
};

defineExpose({
    pop,
    onHoverItem,
    onMouseLeaveItem,
    onClickItem,
    get childMenu() {
        return childMenu.value;
    },
    get isPopped() {
        return isPopped.value;
    },
    get el() {
        return containerEl.value;
    },
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.context-menu-container {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;

    // Allow dragging over the whole screen on touch devices
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;

    &.disableDismiss {
        pointer-events: none;

        > * {
            pointer-events: all;
        }
    }

    &.hasParent {
        pointer-events: none;

        .context-menu {
            pointer-events: auto;
        }
    }

    .context-menu {
        transform-origin: 0% 0%;
        transition: transform 0.2s;

        &.top {
            transform-origin: 0% 100%;
        }

        &.left {
            transform-origin: 100% 0%;

            &.top {
                transform-origin: 100% 100%;
            }
        }

    }

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s;
    }

    &.show-enter-from /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        .context-menu {
            transform: scale(0.8, 0.8);
        }
    }

    &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        .context-menu {
            transform: scale(0.8, 0.8);
        }
    }

    .triangle {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        background: red;
        opacity: 0.5;
        pointer-events: none;
        z-index: 100000;
    }
}

.context-menu {
    position: fixed;
    z-index: 10000;

    background: $color-background;

    --color-current-background: #{$color-background};
    --color-current-background-shade: #{$color-background-shade};
    --color-current-background-shade-darker: #{$color-background-shade-darker};

    border: $border-width-thin solid $color-border;
    padding: 8px 15px 8px 15px;

    @extend %style-overlay-shadow;
    border-radius: $border-radius-modals;
    box-sizing: border-box;
    min-width: 230px;

    @media (max-width: 450px) {
        min-width: 70vw;
    }

    max-width: min(350px, 100vw);
    max-width: min(350px, calc(100vw - 30px));
    overflow: hidden;
    overflow-y: auto;

    // Hide carret in element below the context menu
    transform: translate3d(0, 0, 0);

    .context-menu-item {
        @extend %style-context-menu-item;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        display: flex;
        flex-direction: row;
        align-items: center;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        color: $color-dark;
        min-height: 26px;
        margin-left: -8px;
        margin-right: -8px;
        padding: 3px 8px;
        border-radius: $border-radius;

        .icon {
            //color: $color-gray-text;
        }

        // Fix for button width
        width: 100%;
        text-align: left;
        box-sizing: content-box;

        @media (max-width: 450px) {
            min-height: 38px;
        }

        &.with-description {
            min-height: 42px;
        }

        .description {
            @extend %style-context-menu-item-description;
            padding-top: 6px;
        }

        > .left {
            &:empty {
                display: none;
            }
            flex-shrink: 0;
            padding-right: 10px;
        }

        > .middle {
            padding: 2px 0;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        //.icon:not(.arrow-right-small):not(.arrow-down-small):not(.arrow-up-small) {
        //    width: 20px;
        //    height: 20px;
        //    font-size: 20px;
//
        //    &:before {
        //        font-size: 20px;
        //    }
        //}

        > .right {
            &:empty {
                display: none;
            }
            margin-left: auto;
            flex-shrink: 0;
            padding-left: 20px;
        }

        /** Note we use a class, because :disabled also disables hover events */
        &.disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        &.destructive {
            color: $color-error;
        }

        &:not(.disabled) {
            &.isOpen {
                background: $color-gray-2;
            }

            &.hover {
                background: $color-primary;
                color: $color-primary-contrast;
            }

            &:active:not(.disable-active) {
                background: $color-primary;
                color: $color-primary-contrast;
            }
        }
    }

    .context-menu-line {
        background: $color-border-lighter;
        border: 0;
        outline: 0;
        border-radius: $border-width-thin;
        height: $border-width-thin;
        margin: 6px -20px;

        @media (max-width: 450px) {
            margin: 6px -20px;
        }
    }
}
</style>
