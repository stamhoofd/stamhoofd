<template>
    <div class="webshop-controller" :class="{ 'has-stack': hasStack, 'showing-order': showingOrder, 'showing-progress': !!progress }">
        <header class="webshop-controller-bar">
            <CheckoutProgress v-if="progress" :titles="progress.steps.map(s => s.title)" :current="progress.current" :can-continue="!!continueCheckout" :logo="squareLogo" :hide-steps="showingPreviewColumn" @select="selectStep" />
            <!-- The website link is only shown on the webshop: the order shows a link back to the webshop instead -->
            <WebshopNavigationBar v-else :disable-pop="true" :show-website="!hasStack">
                <template #right>
                    <button v-if="showingOrder" class="button text limit-space" type="button" data-testid="back-to-webshop-button" @click="backToWebshop">
                        <span class="icon close" />
                        <span>{{ $t('%9b') }}</span>
                    </button>
                    <button v-if="cartEnabled && !showingOrder" class="primary button" type="button" data-testid="cart-button" @click="openCart().catch(console.error)">
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
import type { ComponentWithProperties, NavigationController } from '@browser/navigation';
import { FramedComponent } from '@browser/navigation';
import { getWebshopSquareLogo } from '@stamhoofd/components/helpers/webshopIdentity.ts';
import { useProvidePreviewColumnWidths } from '@stamhoofd/components/layout/usePreviewPanel.ts';
import { computed, onMounted, shallowRef } from 'vue';

import { useProvideCheckoutContinue } from '../composables/useCheckoutContinue';
import { useCheckoutManager } from '../composables/useCheckoutManager';
import { useWebshopManager } from '../composables/useWebshopManager';
import CheckoutProgress from './checkout/CheckoutProgress.vue';
import { CheckoutStepsManager } from './checkout/CheckoutStepsManager';
import { getCartComponent } from './checkout/getCartComponent';
import WebshopNavigationBar from './components/WebshopNavigationBar.vue';
import { isOrderComponent } from './orders/getOrderComponent';

/**
 * Renders the webshop's navigation bar as an overlay on a full-screen navigation controller with the webshop as root.
 * Views receive the bar height as their top safe area; on small screens the bar slides away for pushed views,
 * except for the order view: users land there from links in their emails, so the logo stays visible.
 * In the cart and checkout steps, a lower bar with the checkout progress replaces it, also on small screens.
 */
const props = defineProps<{
    /** A NavigationController */
    root: ComponentWithProperties;
}>();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const cartEnabled = computed(() => webshopManager.webshop.shouldEnableCart);
const cartCount = computed(() => checkoutManager.cart.count);
const squareLogo = computed(() => getWebshopSquareLogo(webshopManager.organization, webshopManager.webshop));

const navigationController = shallowRef<InstanceType<typeof NavigationController> | null>(null);
onMounted(() => {
    navigationController.value = props.root.componentInstance() as InstanceType<typeof NavigationController> | null;
});

const hasStack = computed(() => (navigationController.value?.components.length ?? 0) > 1);

const showingOrder = computed(() => {
    const top = navigationController.value?.components.at(-1);
    return !!top && isOrderComponent(top);
});

const progress = computed(() => {
    const url = navigationController.value?.components.at(-1)?.provide.reactive_navigation_url?.url;
    if (!url) {
        return null;
    }
    // The current step stays listed while it is inactive (e.g. after the webshop reloaded), so the bar never switches back
    const steps = CheckoutStepsManager.for(checkoutManager).getSteps()
        .filter(s => s.active || s.url === url)
        .map(s => ({ title: s.title, url: s.url }));
    if (cartEnabled.value || url === 'cart') {
        steps.unshift({ title: $t('%1DQ'), url: 'cart' });
    } else if (navigationController.value?.components.some(c => c.provide.reactive_navigation_url?.url === CheckoutStepsManager.productUrl)) {
        // Opened with the order button of a webshop with one product: the product form is the first step
        const product = webshopManager.webshop.products.find(p => !p.hidden);
        steps.unshift({ title: product?.name ?? $t('%1DQ'), url: CheckoutStepsManager.productUrl });
    }
    const current = steps.findIndex(s => s.url === url);
    if (current === -1) {
        return null;
    }
    return { steps, current };
});

const continueCheckout = useProvideCheckoutContinue();

// The steps would run into the preview column of the visible view (e.g. the order summary next to the payment step)
const previewColumnWidths = useProvidePreviewColumnWidths();
const showingPreviewColumn = computed(() => {
    const top = navigationController.value?.components.at(-1);
    return !!top && (previewColumnWidths.get(top) ?? 0) > 0;
});

/**
 * Previous steps pop back, the next step continues with the same action as the button of the current view
 */
function selectStep(index: number) {
    if (!progress.value) {
        return;
    }
    if (index > progress.value.current) {
        continueCheckout.value?.();
        return;
    }
    CheckoutStepsManager.popToUrl(navigationController.value, progress.value.steps[index].url).catch(console.error);
}

function backToWebshop() {
    navigationController.value?.popToRoot().catch(console.error);
}

async function openCart() {
    // Pop back to the cart instead of pushing a second one
    if (await CheckoutStepsManager.popToUrl(navigationController.value, 'cart')) {
        return;
    }
    await navigationController.value?.push({ components: [await getCartComponent()] });
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

// The navigation controller fills the whole view. The bar is an overlay on top of it, and every view
// receives the bar height as its top safe area, so views keep their own size when the bar hides.
.webshop-controller {
    --webshop-bar-height: 70px;
    --webshop-progress-bar-height: 44px;
    --webshop-bar-inset: calc(var(--webshop-bar-height) + var(--st-safe-area-top, 0px));
    --saved-st-safe-area-top: var(--st-safe-area-top, 0px);

    position: relative;
    height: calc(var(--vh, 1vh) * 100);
    max-height: 100dvh;
    overflow: clip;

    > .webshop-controller-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1;
        height: var(--webshop-bar-inset);
        box-sizing: border-box;
        transition: transform var(--navigation-transition-duration, 300ms);

        > .checkout-progress {
            position: absolute;
            top: var(--saved-st-safe-area-top);
            bottom: 0;
            left: 0;
            right: 0;
        }
    }

    // The checkout progress replaces the logo bar with a lower bar
    &.showing-progress > .webshop-controller-bar {
        height: calc(var(--saved-st-safe-area-top) + var(--webshop-progress-bar-height));
    }

    // Own stacking context, so views and loading overlays (which use z-indexes) never cover the bar
    > .webshop-controller-main {
        position: relative;
        z-index: 0;
    }

    // Every view leaves room for the bar. Set on the view wrapper, so a leaving view keeps its inset while it animates out.
    .navigation-controller > div {
        --st-safe-area-top: var(--webshop-bar-inset);
    }

    // Also on low screens (phones in landscape, iPads with browser chrome): the bar takes too much height there
    @media (max-width: 799px), (max-height: 700px) {
        // Pushed views bring their own navigation bar: they only keep the browser inset and the bar slides away
        // POC: the root view is recognised by its class until the navigation controller marks the stack index itself
        .navigation-controller > div:not(:has(.modern-webshop-view, .order-view)) {
            --st-safe-area-top: var(--saved-st-safe-area-top);
        }

        &.has-stack:not(.showing-order, .showing-progress) > .webshop-controller-bar {
            transform: translateY(-100%);
            pointer-events: none;
            transition-duration: var(--navigation-transition-duration, 300ms);
        }

        &:not(.has-stack) > .webshop-controller-bar {
            transition-duration: var(--navigation-pop-transition-duration, 250ms);
        }
    }

    // Below the checkout progress, every pushed view is the cart or a checkout step: they sit below the progress bar on every
    // screen size. This includes a step that is still loading, which has no content to recognise it by.
    &.showing-progress .navigation-controller > div:not(:has(.modern-webshop-view)) {
        --st-safe-area-top: calc(var(--saved-st-safe-area-top) + var(--webshop-progress-bar-height));
    }
}
</style>
