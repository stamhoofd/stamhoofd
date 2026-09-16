<template>
    <section class="st-view shade modern-webshop-view">
        <main class="center flex" :class="webshopLayout + ' ' + (webshopLayout === 'Default' ? 'enable-grid' : '')">
            <figure v-if="webshop.meta.coverPhoto" class="webshop-banner" :class="{ 'cover-fit': webshop.meta.coverPhotoFit === WebshopCoverPhotoFit.Cover }">
                <ImageComponent :image="webshop.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />
            </figure>

            <div class="columns">
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
                <div class="right container">
                    <template v-if="(!closed || showOpenAt) && products.length > 0">
                        <template v-if="orderMode === WebshopOrderMode.Bulk">
                            <BulkProductList />

                            <div class="style-button-bar">
                                <button type="button" class="button primary full" data-testid="bulk-order-button" @click="startBulkOrder">
                                    <span>{{ orderButtonText }}</span>
                                    <span v-if="totalPrice > 0" class="bulk-total">{{ formatPrice(totalPrice) }}</span>
                                    <span class="icon arrow-right" />
                                </button>
                            </div>
                        </template>
                        <template v-else-if="orderMode === WebshopOrderMode.Single && products.length === 1">
                            <div class="style-button-bar">
                                <button type="button" class="button primary full" data-testid="single-order-button" @click="openSingleProduct(products[0])">
                                    <span>{{ orderButtonText }}</span>
                                    <span class="icon arrow-right" />
                                </button>
                            </div>
                        </template>
                        <div v-else class="products">
                            <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="onAddItem" :is-last="index === categories.length - 1" />
                            <ProductGrid v-if="categories.length === 0" :products="products" :webshop="webshop" :checkout="checkout" :save-handler="onAddItem" />
                        </div>
                    </template>

                    <!-- eslint-disable-next-line vue/no-v-html -> cleaned in backend -->
                    <div v-if="STAMHOOFD.platformName !== 'stamhoofd'" class="style-wysiwyg gray no-underline-links" v-html="platform.config.shopFooterText.html" />
                    <div v-else class="stamhoofd-badge">
                        <a :href="'https://'+ LocalizedDomains.marketing +'?utm_medium=webshop'">{{ $t('%Zkw') }} <Logo /></a>
                    </div>
                </div>
            </div>

            <LegalFooter :organization="organization" :webshop="webshop" />
        </main>
    </section>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import type { useDismiss, usePopup } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { injectCustomCode } from '@stamhoofd/components/helpers/injectCustomCode.ts';
import { MetaKey, useMetaInfo } from '@stamhoofd/components/helpers/useMetaInfo.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import Logo from '@stamhoofd/components/icons/Logo.vue';
import LegalFooter from '@stamhoofd/components/navigation/LegalFooter.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import CategoryBox from '@stamhoofd/components/views/CategoryBox.vue';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import ProductGrid from '@stamhoofd/components/views/ProductGrid.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { UrlHelper } from '@stamhoofd/networking/UrlHelper';
import type { Payment, Product } from '@stamhoofd/structures';
import { CartItem, PaymentStatus, WebshopCoverPhotoFit, WebshopOrderMode } from '@stamhoofd/structures';
import { computed, onMounted } from 'vue';
import { getOrderButtonText } from '../classes/webshopWording';
import { useCheckoutManager } from '../composables/useCheckoutManager';
import { useWebshopManager } from '../composables/useWebshopManager';
import type { CheckoutStep } from './checkout/CheckoutStepsManager';
import { CheckoutStepsManager } from './checkout/CheckoutStepsManager';
import CrowdfundingBar from './components/CrowdfundingBar.vue';
import { getCartComponent } from './checkout/getCartComponent';
import BulkProductList from './products/BulkProductList.vue';

const present = usePresent();
const show = useShow();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
checkoutManager.useRootNavigation = true;
const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const orderMode = computed(() => webshop.value.orderMode);
const cartEnabled = computed(() => webshop.value.shouldEnableCart);
const webshopLayout = computed(() => webshop.value.meta.layout);
const checkout = computed(() => checkoutManager.checkout);
const cart = computed(() => checkoutManager.cart);
const cartCount = computed(() => checkoutManager.cart.count);
const totalPrice = computed(() => checkoutManager.checkout.totalPrice);
const orderButtonText = computed(() => getOrderButtonText(webshop.value));
const bannerImage = computed(() => webshop.value.meta.coverPhoto?.getResolutionForSize(Math.min(document.documentElement.clientWidth - 30, 900), undefined));
const bannerImageSrc = computed(() => bannerImage.value?.file.getPublicPath());
const bannerImageWidth = computed(() => bannerImage.value?.width);
const bannerImageHeight = computed(() => bannerImage.value?.height);
const platform = usePlatform();
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
function openCart(animated = true, components: ComponentWithProperties[] = []) {
    if (!cartEnabled.value && components.length === 0) {
        openCheckout(animated).catch(console.error);
        return;
    }

    show({
        animated,
        adjustHistory: animated,
        components: [
            ...(cartEnabled.value ? [getCartComponent()] : []),
            ...components,
        ],
    }).catch(console.error);
}

function startBulkOrder() {
    if (cartCount.value === 0) {
        Toast.warning($t('Maak eerst een keuze')).show();
        return;
    }
    openCheckout(true).catch(console.error);
}

/**
 * Single mode with one product: open the cart item view directly (no product box)
 */
function openSingleProduct(product: Product) {
    const oldItem = cart.value.items.find(i => i.product.id === product.id);
    let cartItem = oldItem?.clone() ?? CartItem.createDefault(product, cart.value, webshop.value, { admin: false });

    if (oldItem) {
        try {
            cartItem.refresh(webshop.value);
        } catch (e) {
            console.error(e);
            cartItem = CartItem.createDefault(product, cart.value, webshop.value, { admin: false });
        }
    }

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('@stamhoofd/components/views/CartItemView.vue'), {
                    admin: false,
                    cartItem,
                    oldItem,
                    cart: cart.value,
                    webshop: webshop.value,
                    checkout: checkout.value,
                    saveHandler: onAddItem,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

// 2 minutes in advance already
const closed = computed(() => webshop.value.isClosed(2 * 60 * 1000) || !organization.value.meta.packages.useWebshops);
const almostClosed = computed(() => webshop.value.isClosed(6 * 60 * 60 * 1000) && !closed.value);
const showOpenAt = computed(() => closed.value && webshop.value.opensInTheFuture());
const products = computed(() => webshop.value.products.filter(p => !p.hidden));
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

function onAddItem(cartItem: CartItem, oldItem: CartItem | null, args: { dismiss: ReturnType<typeof useDismiss> }) {
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

        openCart(true);
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

/**
* Update cart
*/
async function check() {
    try {
        // Bulk: seats and details are only collected during the checkout
        const bulk = webshop.value.orderMode === WebshopOrderMode.Bulk;
        cart.value.validate(webshopManager.webshop, false, { validateSeats: !bulk, validateDetails: !bulk });
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
            openCart(false);
        }

        const code = path[1];
        checkoutManager.applyCode(code).catch(console.error);
    } else if (path.length === 2 && path[0] === 'order') {
        const orderId = path[1];
        present({
            animated: false,
            adjustHistory: false,
            components: [
                AsyncComponent(() => import('./orders/OrderView.vue'), { orderId }),
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

        present({
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
                            if (!navigationActions.popup) {
                                // We are not in a popup/sheet on mobile
                                // So replace with a force instead of dimissing
                                present({
                                    components: [
                                        AsyncComponent(() => import('./orders/OrderView.vue'), { paymentId: payment.id, success: true }),
                                    ],
                                    replace: 1,
                                    force: true,
                                }).catch(console.error);
                            } else {
                                // In popup/sheet on desktop
                                navigationActions.dismiss({ force: true, animated: true }).catch(console.error);
                                present({
                                    components: [
                                        AsyncComponent(() => import('./orders/OrderView.vue'), { paymentId: payment.id, success: true }),
                                    ],
                                }).catch(console.error);
                            }
                        } else {
                            navigationActions.dismiss({ force: true }).catch(console.error);

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
            modalDisplayStyle: 'sheet', // warning: if changing to popup: present won't work on mobile devices in the finishedhandler (because this is deactivated -> no parents)!
            url: path.join('/'),
        }).catch(console.error);
    } else if (path.length >= 2 && path[0] === 'checkout') {
        resumeStep('/' + path.join('/'), false).catch((e) => {
            console.error(e);
        });
    } else if (path.length === 1 && path[0] === 'cart' && cartEnabled.value) {
        openCart(false);
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
    openCart(animated, components);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.modern-webshop-view {
    .columns {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
    }
    --st-vertical-padding: 0;

    > main.Split {
        // Increase width
        --st-view-max-width: 1100px;

        .columns {
            display: grid;
            grid-template-columns: 1fr 450px;
            gap: 20px;
        }

        @media (max-width: 900px) {
            .columns {
                grid-template-columns: 1fr;
            }
        }
    }

    .columns > .right {
        position: sticky;
        top: 0;
        align-self: flex-start;
        padding: 15px 0;
    }

    .content > h1 {
        @extend %style-title-semihuge;
        padding-bottom: 10px;
    }

    // The webshop bar above already provides the spacing
    > main {
        padding-top: 20px;
    }

    // Banner mode: fill the width with a limited height and crop the photo
    .webshop-banner.cover-fit .style-cover-photo {
        max-height: max(250px, 33vh);

        img {
            object-fit: cover !important;
        }
    }

    .bulk-total {
        opacity: 0.7;
        padding-left: 5px;
    }
}

.stamhoofd-badge {
    padding-top: 15px;
    --color-primary: #{$color-primary-original};
    text-align: center;

    > a {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        max-width: none;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 12px;

        svg {
            height: 20px;
            width: auto;
        }

        &,
        &:hover,
        &:link,
        &:active,
        &:visited {
            color: $color-gray-text;
            font-weight: 600;
            text-decoration: none;
        }
    }
}
</style>
