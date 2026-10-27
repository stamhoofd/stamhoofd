<template>
    <!-- Scrolling the page or the column closes the toast after adding an item (scroll events only reach the panel while capturing) -->
    <PreviewPanel v-model:wide="previewWide" class="modern-webshop" @scroll.capture.passive="hideCartToast">
        <section class="st-view background modern-webshop-view">
            <!-- Gives the bar of the WebshopController (in the safe area) a background while scrolling -->
            <STNavigationBar :safe-area-only="true" />
            <main class="flex enable-grid">
                <figure v-if="webshop.meta.coverPhoto" class="webshop-banner">
                    <ImageComponent :image="webshop.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />
                </figure>

                <div class="content">
                    <h1>{{ webshop.meta.title || webshop.meta.name }}</h1>

                    <template v-if="webshop.meta.crowdfunding">
                        <CrowdfundingBar :crowdfunding="webshop.meta.crowdfunding" />
                        <hr class="style-hr">
                    </template>

                    <!-- eslint-disable-next-line vue/no-v-html -> cleaned in backend -->
                    <div v-if="webshop.meta.description.html" class="style-wysiwyg gray" v-html="webshop.meta.description.html" />
                    <p v-else-if="webshop.meta.description.text" class="description" v-text="webshop.meta.description.text" />

                    <p v-if="showOpenAt" class="info-box">
                        {{ $t('%Xj') }} {{ webshop.meta.openAt ? formatDateTime(webshop.meta.openAt) : '?' }}
                    </p>
                    <p v-else-if="closed" class="info-box">
                        {{ $t('%Xk') }}
                    </p>
                    <p v-else-if="almostClosed" class="info-box">
                        {{ $t('%Xl') }} {{ webshop.meta.availableUntil ? formatTime(webshop.meta.availableUntil) : '?' }}
                    </p>
                    <p v-if="products.length === 0" class="info-box">
                        {{ $t('%Xm') }}
                    </p>
                </div>

                <template v-if="!showPreview">
                    <CartItemView v-if="embeddedCartItem" :key="embeddedCartItem.id" :cart-item="embeddedCartItem" :old-item="embeddedCartItem" :checkout="checkout" :webshop="webshop" :save-handler="onAddEmbeddedItem" :live-save-handler="saveLiveCartItem" :embedded="true" />
                    <WebshopProducts v-else-if="canOrder" :webshop="webshop" :checkout="checkout" :products="products" :categories="categories" :save-handler="onAddItem" @click="hideCartToast" @open-single-product="openSingleProduct" />
                    <WebshopCartButton v-if="showCartButton" :count="cartCount" @open="showCart().catch(console.error)" />
                    <WebshopPlatformFooter />
                </template>
                <PreviewOutlet />

                <!-- The platform footer is shown right below the ordering part instead -->
                <LegalFooter :organization="organization" :webshop="webshop" :hide-platform-footer="true" />
            </main>
        </section>

        <!-- Ordering happens next to the content (below it on small screens) -->
        <template v-if="showPreview" #preview>
            <CartItemView v-if="embeddedCartItem" :key="embeddedCartItem.id" :cart-item="embeddedCartItem" :old-item="embeddedCartItem" :checkout="checkout" :webshop="webshop" :save-handler="onAddEmbeddedItem" :live-save-handler="saveLiveCartItem" :embedded="true" />
            <WebshopProducts v-else :webshop="webshop" :checkout="checkout" :products="products" :categories="categories" :save-handler="onAddItem" @click="hideCartToast" @open-single-product="openSingleProduct" />
            <WebshopCartButton v-if="showCartButton" :count="cartCount" @open="showCart().catch(console.error)" />
            <WebshopPlatformFooter />
        </template>
    </PreviewPanel>
</template>

<script lang="ts" setup>
import { SimpleError } from '@common/errors';
import type { useDismiss, usePopup } from '@browser/navigation';
import { ComponentWithProperties, NavigationController, ReactiveUrl, useNavigationController, usePresent, useShow } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { injectCustomCode } from '@stamhoofd/components/helpers/injectCustomCode.ts';
import { MetaKey, useMetaInfo } from '@stamhoofd/components/helpers/useMetaInfo.ts';
import PreviewOutlet from '@stamhoofd/components/layout/PreviewOutlet.vue';
import PreviewPanel from '@stamhoofd/components/layout/PreviewPanel.vue';
import LegalFooter from '@stamhoofd/components/navigation/LegalFooter.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast, ToastButton } from '@stamhoofd/components/overlays/Toast.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import CartItemView from '@stamhoofd/components/views/CartItemView.vue';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import type { Payment, Product } from '@stamhoofd/structures';
import { Cart, CartItem, PaymentStatus, WebshopLayout, WebshopOrderMode } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, onDeactivated, onMounted, ref, watch } from 'vue';
import { useCheckoutManager } from '../composables/useCheckoutManager';
import { useWebshopManager } from '../composables/useWebshopManager';
import type { CheckoutStep } from './checkout/CheckoutStepsManager';
import { CheckoutStepsManager } from './checkout/CheckoutStepsManager';
import CrowdfundingBar from './components/CrowdfundingBar.vue';
import WebshopCartButton from './components/WebshopCartButton.vue';
import WebshopPlatformFooter from './components/WebshopPlatformFooter.vue';
import WebshopProducts from './components/WebshopProducts.vue';
import { getCartComponent } from './checkout/getCartComponent';
import { getOrderComponent } from './orders/getOrderComponent';

const present = usePresent();
const show = useShow();
const navigationController = useNavigationController();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const orderMode = computed(() => webshop.value.orderMode);
const cartEnabled = computed(() => webshop.value.shouldEnableCart);
const cartCount = computed(() => checkoutManager.cart.count);
const showCartButton = computed(() => cartEnabled.value && cartCount.value > 0);
const webshopLayout = computed(() => webshop.value.meta.layout);
// Whether the ordering part fits next to the content
const previewWide = ref(false);
const checkout = computed(() => checkoutManager.checkout);
const cart = computed(() => checkoutManager.cart);
const bannerImage = computed(() => webshop.value.meta.coverPhoto?.getResolutionForSize(Math.min(document.documentElement.clientWidth - 30, 900), undefined));
const bannerImageSrc = computed(() => bannerImage.value?.file.getPublicPath());
const bannerImageWidth = computed(() => bannerImage.value?.width);
const bannerImageHeight = computed(() => bannerImage.value?.height);
injectCustomCode(webshopManager.webshop);

useMetaInfo({
    title: `${webshopManager.webshop.meta.name} | ${webshopManager.organization.name}`,
    options: {
        key: MetaKey.Routing,
    },
    meta: [
        {
            id: 'description',
            name: 'description',
            content: webshopManager.webshop.meta.description.text,
        },
        {
            id: 'og:site_name',
            name: 'og:site_name',
            content: webshopManager.organization.name,
        },
        {
            id: 'og:title',
            name: 'og:title',
            content: webshopManager.webshop.meta.title ?? webshopManager.webshop.meta.name,
        },
        {
            id: 'og:image',
            name: 'og:image',
            content: bannerImageSrc,
        },
        {
            id: 'og:image:width',
            name: 'og:image:width',
            content: bannerImageWidth,
        },
        {
            id: 'og:image:height',
            name: 'og:image:height',
            content: bannerImageHeight,
        },
        {
            id: 'og:image:type',
            name: 'og:image:type',
            content: computed(() => bannerImageSrc.value === undefined ? undefined : bannerImageSrc.value.endsWith('.png') ? 'image/png' : 'image/jpeg'),
        },
    ],
});

async function openCheckout(animated = true) {
    try {
        // Force a save if nothing changed (to fix timeSlot + updated data)
        const nextStep = await CheckoutStepsManager.for(checkoutManager).getNextStep(undefined, false);
        if (!nextStep) {
            throw new SimpleError({
                code: 'missing_config',
                message: 'Er ging iets mis bij het ophalen van de volgende stap',
            });
        }

        await show({
            animated,
            adjustHistory: animated,
            components: [await CheckoutStepsManager.for(checkoutManager).getStepComponent(nextStep)],
        });
    } catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

/**
 * Cart and checkout steps live on the navigation controller of the webshop itself
 */
async function openCart(animated = true, components: ComponentWithProperties[] = []) {
    if (!cartEnabled.value && components.length === 0) {
        await openCheckout(animated);
        return;
    }

    let first: ComponentWithProperties[] = [];
    if (cartEnabled.value) {
        first = [await getCartComponent()];
    } else if (orderButtonProduct.value) {
        first = [getSingleProductComponent(orderButtonProduct.value)];
    }

    await show({
        animated,
        adjustHistory: animated,
        components: [...first, ...components],
    });
}

/**
 * Back to the cart when it is already open (e.g. from the cart button), otherwise open it
 */
async function showCart() {
    if (await CheckoutStepsManager.popToUrl(navigationController.value, 'cart')) {
        return;
    }
    await openCart(true);
}

/**
 * Single mode: the cart only holds the item of the one product. Returns that item, added to the cart when missing,
 * so the form edits it in place and every change is stored right away (live editing).
 */
function getLiveCartItem(product: Product): CartItem {
    const existing = checkoutManager.cart.items.find(i => i.product.id === product.id);
    if (existing) {
        try {
            // Only refresh it against the webshop: a half filled in item is kept as is
            existing.validate(webshop.value, Cart.create({}), { refresh: true, admin: false, validateSeats: false, validateDetails: false });
            return existing;
        } catch (e) {
            console.error(e);
        }
    }
    const item = CartItem.createDefault(product, checkoutManager.cart, webshop.value, { admin: false });
    saveLiveCartItem(item);
    return item;
}

function saveLiveCartItem(item: CartItem) {
    if (!checkoutManager.cart.items.includes(item)) {
        checkoutManager.cart.clear();
        checkoutManager.cart.addItem(item, false);
    }
    checkoutManager.saveCart();
}

/**
 * Single mode with one product: open the cart item view directly (no product box)
 */
function openSingleProduct(product: Product, animated = true) {
    show({
        animated,
        adjustHistory: animated,
        components: [getSingleProductComponent(product)],
    }).catch(console.error);
}

/**
 * The first step of the checkout: the checkout is pushed on top of it, so the progress can return to it
 */
function getSingleProductComponent(product: Product) {
    const cartItem = getLiveCartItem(product);
    const component = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('@stamhoofd/components/views/CartItemView.vue'), {
            admin: false,
            cartItem,
            oldItem: cartItem,
            cart: cart.value,
            webshop: webshop.value,
            checkout: checkout.value,
            saveHandler: onAddEmbeddedItem,
            liveSaveHandler: saveLiveCartItem,
        }),
    });
    component.provide.reactive_navigation_url = new ReactiveUrl({ url: CheckoutStepsManager.productUrl });
    return component;
}

// 2 minutes in advance already
const closed = computed(() => webshop.value.isClosed(2 * 60 * 1000) || !organization.value.meta.packages.useWebshops);
const almostClosed = computed(() => webshop.value.isClosed(6 * 60 * 60 * 1000) && !closed.value);
const showOpenAt = computed(() => closed.value && webshop.value.opensInTheFuture());
const products = computed(() => webshop.value.products.filter(p => !p.hidden));

/**
 * Single mode with one product: the order form is shown on the page itself instead of an order button.
 * When the content is stacked above the ordering part, only without a description: a title with only an order button looks empty, but a description followed by a long form is too much.
 */
const embeddedProduct = computed(() => {
    if (closed.value || orderMode.value !== WebshopOrderMode.Single || products.value.length !== 1) {
        return null;
    }
    // Check the text: a description that was cleared in the editor still has html like <p></p>
    const hasDescription = webshop.value.meta.description.text.trim().length > 0;
    // The split layout only shows the form next to the description while it fits, otherwise it behaves like the stacked layout
    if (hasDescription && (webshopLayout.value !== WebshopLayout.Split || !previewWide.value)) {
        return null;
    }
    return products.value[0];
});

// Single mode with one product, without the form on the page: an order button opens the product as the first checkout step
const orderButtonProduct = computed(() => {
    if (embeddedProduct.value || orderMode.value !== WebshopOrderMode.Single || products.value.length !== 1) {
        return null;
    }
    return products.value[0];
});

const canOrder = computed(() => (!closed.value || showOpenAt.value) && products.value.length > 0);

// Only in the split layout: the stacked layout shows the products or the form below the content
const showPreview = computed(() => {
    if (webshopLayout.value !== WebshopLayout.Split) {
        return false;
    }
    if (embeddedProduct.value) {
        return true;
    }
    // Without room for the form next to the description, the order button is shown below it, like in the stacked layout
    if (orderButtonProduct.value) {
        return false;
    }
    return canOrder.value;
});

const embeddedCartItem = ref(null) as Ref<CartItem | null>;
// Also when the checkout is replaced (e.g. cleared after an order), so the form keeps editing the item in the cart
watch([embeddedProduct, checkout], ([product]) => {
    embeddedCartItem.value = product ? getLiveCartItem(product) : null;
}, { immediate: true });
const categories = computed(() => {
    return webshop.value.categories.filter((c) => {
        const products = c.productIds.flatMap((id) => {
            const product = webshop.value.products.find(p => p.id === id);
            if (product && !product.hidden) {
                return [product];
            }
            return [];
        });
        return products.length > 0;
    });
});

/**
 * The toast after adding an item covers the buttons at the bottom of the cart and of a product: it closes as soon as
 * either opens (pushing the cart deactivates this view, a product opens with a click in the products), or when the page scrolls
 */
let cartToast: Toast | null = null;

function hideCartToast() {
    cartToast?.hide();
    cartToast = null;
}

onDeactivated(hideCartToast);

function onAddItem(cartItem: CartItem, oldItem: CartItem | null, args: { dismiss: ReturnType<typeof useDismiss> } | null) {
    if (cartEnabled.value) {
        if (args) {
            args.dismiss({ force: true }).catch(console.error);
        }

        if (oldItem) {
            checkoutManager.cart.replaceItem(oldItem, cartItem);
        } else {
            checkoutManager.cart.addItem(cartItem);
        }
        checkoutManager.saveCart();

        // Stay in the webshop to add more, the cart opens from the toast or the cart button
        hideCartToast();
        cartToast = Toast.success($t('{name} is toegevoegd aan jouw winkelmandje', { name: cartItem.product.name }))
            .setButton(new ToastButton($t('Bekijk winkelmandje'), () => {
                showCart().catch(console.error);
            }))
            .setTestId('cart-added-toast')
            .show();
    } else {
        checkoutManager.cart.clear();
        if (args) {
            args.dismiss({ force: true }).catch(console.error);
        }
        checkoutManager.cart.addItem(cartItem);
        checkoutManager.saveCart();
        openCheckout(true).catch(console.error);
    }
}

function onAddEmbeddedItem(cartItem: CartItem, oldItem: CartItem | null, component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean }) {
    // The form itself is part of the page or a checkout step and can't be dismissed, but the seat selection it presents on top can
    onAddItem(cartItem, oldItem, component.canDismiss ? component : null);
}

/**
* Update cart
*/
async function check() {
    try {
        cart.value.validate(webshopManager.webshop);
    } catch (e) {
        console.error(e);
    }
    checkoutManager.saveCart();

    try {
        await checkoutManager.validateCodes();
    } catch (e) {
        console.error(e);
    }
}

onMounted(() => {
    const path = UrlHelper.shared.getParts();
    const params = UrlHelper.shared.getSearchParams();
    UrlHelper.shared.clear();

    check().catch(console.error);

    if (path.length === 2 && path[0] === 'code') {
        if (cartEnabled.value) {
            openCart(false).catch(console.error);
        }

        const code = path[1];
        checkoutManager.applyCode(code).catch(console.error);
    } else if (path.length === 2 && path[0] === 'order') {
        const orderId = path[1];
        show({
            animated: false,
            adjustHistory: false,
            components: [
                getOrderComponent({ orderId }),
            ],
            url: path.join('/'),
        }).catch(console.error);
    } else if (path.length === 2 && path[0] === 'tickets') {
        const secret = path[1];
        present({
            animated: false,
            adjustHistory: false,
            components: [
                AsyncComponent(() => import('./orders/TicketView.vue'), { secret }),
            ],
            url: path.join('/'),
        }).catch(console.error);
    } else if (path.length === 1 && path[0] === 'payment' && params.get('id')) {
        const paymentId = params.get('id');
        const cancel = params.get('cancel') === 'true';

        show({
            adjustHistory: false,
            animated: false,
            force: true,
            components: [
                AsyncComponent(() => import('@stamhoofd/components/payments/PaymentPendingView.vue'), {
                    server: webshopManager.server,
                    paymentId,
                    cancel,
                    finishedHandler: function (navigationActions: NavigationActions & { popup: ReturnType<typeof usePopup> }, payment: Payment | null) {
                        if (payment && payment.status === PaymentStatus.Succeeded) {
                            navigationActions.show({
                                components: [
                                    getOrderComponent({ paymentId: payment.id, success: true }),
                                ],
                                replace: 1, // replace pending view
                                force: true,
                            }).catch(console.error);
                        } else {
                            navigationActions.pop({ force: true })?.catch(console.error);

                            // Force reload webshop (stock will have changed: prevent invalidating the cart)
                            // Update stock in background
                            webshopManager.reload().catch((e) => {
                                console.error(e);
                            });

                            new CenteredMessage($t('Betaling mislukt'), $t('De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.')).addCloseButton(undefined, async () => {
                                await resumeStep('/checkout/payment');
                            }).show();
                        }
                    },
                }),
            ],
            url: path.join('/'),
        }).catch(console.error);
    } else if (path.length >= 2 && path[0] === 'checkout') {
        resumeStep('/' + path.join('/'), false).catch((e) => {
            console.error(e);
        });
    } else if (path.length === 1 && path[0] === 'cart' && cartEnabled.value) {
        openCart(false).catch(console.error);
    } else if (path.length === 1 && path[0] === CheckoutStepsManager.productUrl && orderButtonProduct.value && !closed.value) {
        openSingleProduct(orderButtonProduct.value, false);
    }
});

async function resumeStep(destination: string, animated = true) {
    // Quickly recreate all steps
    let step: CheckoutStep | undefined = undefined;
    const waitingComponents: Promise<ComponentWithProperties>[] = [];

    while (!step || step.url !== destination) {
        try {
            const nextStep = await CheckoutStepsManager.for(checkoutManager).getNextStep(step?.id);
            if (!nextStep) {
                break;
            }

            waitingComponents.push(CheckoutStepsManager.for(checkoutManager).getStepComponent(nextStep));
            step = nextStep;
        } catch (e) {
            // Possible invalid checkout -> stop here
            break;
        }
    }

    const components = await Promise.all(waitingComponents);
    await openCart(animated, components);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.modern-webshop-view {
    // Needs a unit: it is added to the safe area in calc()
    --st-vertical-padding: 0px;

    // Only below the content: in the preview (next to or below the content) the preview has its own padding
    > main > .webshop-products, > main > .cart-item-view {
        padding: 30px 0 15px 0;
    }

    .content > h1 {
        @extend %style-title-semihuge;
        padding-bottom: 10px;
    }
}

// Below the content, the ordering part continues the page without its own background color
.modern-webshop-view .preview-outlet > .preview-panel-preview {
    background: $color-background;
    --color-current-background: #{$color-background};
    --color-current-background-shade: #{$color-background-shade};
    --color-current-background-shade-darker: #{$color-background-shade-darker};
    --rgb-current-background: var(--rgb-background, 255);
}

// The cart button sticks to the bottom of the column: the bottom padding of the column moves into the preview, so nothing scrolls below the button
.modern-webshop .preview-panel-column {
    padding-bottom: 0;

    .preview-panel-preview {
        padding-bottom: var(--preview-panel-padding-bottom);
    }
}

// The column next to the content is narrow: the order button of the form takes its full width
.modern-webshop .preview-panel-column .cart-item-view.embedded .style-button-bar {
    > .loading-button {
        width: 100%;
        max-width: none;
    }

    .button {
        width: 100%;
    }
}
</style>
