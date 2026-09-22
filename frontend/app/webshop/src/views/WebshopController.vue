<template>
    <div class="webshop-controller" :class="{ 'has-stack': hasStack }">
        <header class="webshop-controller-bar">
            <WebshopNavigationBar :disable-pop="true">
                <template #right>
                    <button v-if="cartEnabled" class="primary button" type="button" data-testid="cart-button" @click="openCart">
                        <span class="icon basket" />
                        <span>{{ cartCount }}</span>
                    </button>
                </template>
            </WebshopNavigationBar>
        </header>
        <div class="webshop-controller-main">
            <FramedComponent v-if="root" :key="root.key" :root="root" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { FramedComponent } from '@simonbackx/vue-app-navigation';
import { computed, onMounted, shallowRef } from 'vue';

import { useCheckoutManager } from '../composables/useCheckoutManager';
import { useWebshopManager } from '../composables/useWebshopManager';
import { getCartComponent } from './checkout/getCartComponent';
import WebshopNavigationBar from './components/WebshopNavigationBar.vue';

/**
 * Renders the webshop's navigation bar once, above a navigation controller with the webshop as root.
 * Views pushed on that controller (cart, checkout steps) are centered in a box below the bar on large screens.
 */
const props = defineProps<{
    /** A NavigationController */
    root: ComponentWithProperties;
}>();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const cartEnabled = computed(() => webshopManager.webshop.shouldEnableCart);
const cartCount = computed(() => checkoutManager.cart.count);

const navigationController = shallowRef<InstanceType<typeof NavigationController> | null>(null);
onMounted(() => {
    navigationController.value = props.root.componentInstance() as InstanceType<typeof NavigationController> | null;
});

const hasStack = computed(() => (navigationController.value?.components.length ?? 0) > 1);

function openCart() {
    const controller = navigationController.value;
    if (!controller) {
        return;
    }
    if (controller.components.some(c => c.provide.reactive_navigation_url?.url === 'cart')) {
        return;
    }
    controller.push({ components: [getCartComponent()] }).catch(console.error);
}

const returnToHistoryIndex = () => {
    return props.root.returnToHistoryIndex();
};

defineExpose({
    returnToHistoryIndex,
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.webshop-controller {
    --webshop-bar-height: 80px;
    display: flex;
    flex-direction: column;
    height: calc(var(--vh, 1vh) * 100);
    max-height: 100dvh;
    overflow: clip;
    --saved-vh: var(--vh, 1vh);

    // Same background as a shaded view, so the bar blends in
    background: $color-background-shade;
    --color-current-background: #{$color-background-shade};
    --color-current-background-shade: #{$color-background-shade-darker};
    --color-current-background-shade-darker: #{$color-background-shade-darker-darker};
    --rgb-current-background: var(--rgb-background-shade, 255);

    // STNavigationBar is positioned absolutely inside a zero-height container: reserve its height here
    > .webshop-controller-bar {
        flex-shrink: 0;
        position: relative;
        height: var(--webshop-bar-height);
        z-index: 1;

        body.native-android &, body.web-android & {
            --webshop-bar-height: 70px;
        }
    }

    > .webshop-controller-main {
        flex-grow: 1;
        min-height: 0;
        // Views size themselves with --vh: the space below the bar
        --vh: calc((var(--saved-vh, 1vh) * 100 - var(--webshop-bar-height)) / 100);
    }

    @media (max-width: 799px) {
        // Pushed views bring their own navigation bar
        &.has-stack {
            > .webshop-controller-bar {
                display: none;
            }

            > .webshop-controller-main {
                --vh: var(--saved-vh, 1vh);
            }
        }
    }

    @media (min-width: 800px) {
        // Pushed views are centered in a box of a fixed width; their content centers itself inside it (main.center)
        &.has-stack > .webshop-controller-main {
            --webshop-box-width: min(100vw, 800px);
            //padding: 20px 0;
            box-sizing: border-box;
            --vh: calc((var(--saved-vh, 1vh) * 100 - 0px - var(--webshop-bar-height)) / 100);
            --vw: calc(var(--webshop-box-width) / 100);
            // Views that center their content (main.center) fill the box instead of a narrower column
            --st-view-max-width: var(--webshop-box-width);
            --st-horizontal-padding: var(--sheet-horizontal-padding, 30px);
            --st-vertical-padding: var(--sheet-vertical-padding, 30px);

            .navigation-controller .st-view:not(.st-view .st-view) {
                contain: content;
                width: var(--webshop-box-width);
                margin: 0 auto;
                height: auto;
                min-height: min(500px, calc(var(--vh, 1vh) * 100));
                max-height: calc(var(--vh, 1vh) * 100);
                border-radius: $border-radius-modals;
                border: 1px solid $color-border-lighter;
                background: $color-background;

                --color-current-background: #{$color-background};
                --color-current-background-shade: #{$color-background-shade};
                --color-current-background-shade-darker: #{$color-background-shade-darker};
            }
        }
    }
}
</style>
