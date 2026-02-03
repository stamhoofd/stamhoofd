<template>
    <section class="st-view shade webshop-view">
        <STNavigationBar :large="true" :left-logo="true">
            <template #left>
                <OrganizationLogo :organization="organization" :webshop="webshop" />
            </template>

            <template #right>
                <button v-if="isLoggedIn" type="button" class="button text limit-space" @click="switchAccount">
                    <span class="icon user" />
                    <span>{{ userName }}</span>
                </button>
                <a v-else-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>{{ $t('6de2861f-64bc-44fe-af80-5742c91d03d6') }}</span>
                </a>
                <button v-if="cartEnabled" class="primary button" type="button" @click="openCart(true)">
                    <span class="icon basket" />
                    <span>{{ cartCount }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main>
            <div class="webshop-layout" :class="webshopLayout + ' ' + (webshopLayout === 'Default' ? 'enable-grid' : '')">
                <header class="webshop-header">
                    <figure v-if="bannerImageSrc" class="webshop-banner">
                        <img :src="bannerImageSrc" :width="bannerImageWidth" :height="bannerImageHeight">
                    </figure>
                    <h1>{{ webshop.meta.title || webshop.meta.name }}</h1>

                    <!-- eslint-disable-next-line vue/no-v-html -> cleaned in backend -->
                    <div v-if="webshop.meta.description.html" class="style-wysiwyg gray" v-html="webshop.meta.description.html" />
                    <p v-else-if="webshop.meta.description.text" class="description" v-text="webshop.meta.description.text" />

                    <p v-if="showOpenAt" class="info-box">
                        {{ $t('239f3ae0-a3c7-4c39-98d8-f2de79539f21') }} {{ webshop.meta.openAt ? formatDateTime(webshop.meta.openAt) : '?' }}
                    </p>
                    <p v-else-if="closed" class="info-box">
                        {{ $t('44cbcf37-42a8-46f1-81fb-d0d3184b76de') }}
                    </p>
                    <p v-else-if="almostClosed" class="info-box">
                        {{ $t('21f590bf-891a-4b07-a7f5-b7ca1cf28c24') }} {{ webshop.meta.availableUntil ? formatTime(webshop.meta.availableUntil) : '?' }}
                    </p>
                    <p v-if="categories.length === 0 && products.length === 0" class="info-box">
                        {{ $t('d03225ed-db4a-4cd2-8df4-8932b6820b17') }}
                    </p>
                </header>

                <template v-if="(!closed || showOpenAt) && (categories.length > 0 || products.length > 0)">
                    <FullPageProduct v-if="products.length === 1 && webshopLayout === 'Split'" :product="products[0]" :webshop="webshop" :checkout="checkout" :save-handler="onAddItem" />
                    <div v-else class="products">
                        <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="onAddItem" :is-last="index === categories.length - 1" />
                        <ProductGrid v-if="categories.length === 0" :products="products" :webshop="webshop" :checkout="checkout" :save-handler="onAddItem" />
                    </div>
                </template>
            </div>

            <LegalFooter :organization="organization" :webshop="webshop" />
        </main>
    </section>
</template>

<script lang="ts" setup>

import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, type useDismiss, type usePopup, usePresent } from '@simonbackx/vue-app-navigation';
import { CategoryBox, CenteredMessage, GlobalEventBus, injectCustomCode, LegalFooter, MetaKey, NavigationActions, OrganizationLogo, PaymentPendingView, ProductGrid, STNavigationBar, Toast, useContext, useMetaInfo } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { CartItem, LoginProviderType, Payment, PaymentStatus } from '@stamhoofd/structures';

import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import { useCheckoutManager } from '../composables/useCheckoutManager';
import { useWebshopManager } from '../composables/useWebshopManager';
import CartView from './checkout/CartView.vue';
import { CheckoutStep, CheckoutStepsManager } from './checkout/CheckoutStepsManager';
import OrderView from './orders/OrderView.vue';
import TicketView from './orders/TicketView.vue';

import FullPageProduct from './FullPageProduct.vue';

const visible = ref(true);

const context = useContext();
const present = usePresent();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const cartEnabled = computed(() => webshop.value.shouldEnableCart);
const webshopLayout = computed(() => webshop.value.meta.layout);
const checkout = computed(() => checkoutManager.checkout);
const cart = computed(() => checkoutManager.cart);
const cartCount = computed(() => checkoutManager.cart.count);
const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const userName = computed(() => context.value.user?.firstName ?? '');
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

function switchAccount() {
    // Do a silent logout
    context.value.removeFromStorage();

    // Redirect to login
    context.value.startSSO({
        webshopId: webshop.value.id,
        prompt: 'select_account',
        providerType: LoginProviderType.SSO,
    }).catch(console.error);
}

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

        const nextComponent = await nextStep.getComponent();
        nextComponent.provide.reactive_navigation_url = nextStep.url;

        present({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(NavigationController, {
                    initialComponents: [nextComponent],
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

function openCart(animated = true, components: ComponentWithProperties[] = []) {
    if (!cartEnabled.value && components.length === 0) {
        openCheckout(animated).catch(console.error);
        return;
    }

    const getCartComponentWithUrl = () => {
        const cartComponent = new ComponentWithProperties(CartView);
        cartComponent.provide.reactive_navigation_url = 'cart';
        return cartComponent;
    };

    present({
        animated,
        adjustHistory: animated,
        components: [
            new ComponentWithProperties(NavigationController, {
                initialComponents: [
                    ...(cartEnabled.value ? [getCartComponentWithUrl()] : []),
                    ...components,
                ],
            }),
        ],
        modalDisplayStyle: 'popup',
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
        }
        else {
            checkoutManager.cart.addItem(cartItem);
        }
        checkoutManager.saveCart();

        openCart(true);
    }
    else {
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
        cart.value.validate(webshopManager.webshop);
    }
    catch (e) {
        console.error(e);
    }
    checkoutManager.saveCart();

    try {
        await checkoutManager.validateCodes();
    }
    catch (e) {
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
    }
    else if (path.length === 2 && path[0] === 'order') {
        const orderId = path[1];
        present({
            animated: false,
            adjustHistory: false,
            components: [
                new ComponentWithProperties(OrderView, { orderId }),
            ],
            url: path.join('/'),
        }).catch(console.error);
    }
    else if (path.length === 2 && path[0] === 'tickets') {
        const secret = path[1];
        present({
            animated: false,
            adjustHistory: false,
            components: [
                new ComponentWithProperties(TicketView, { secret }),
            ],
            url: path.join('/'),
        }).catch(console.error);
    }
    else if (path.length === 1 && path[0] === 'payment' && params.get('id')) {
        const paymentId = params.get('id');
        const cancel = params.get('cancel') === 'true';

        present({
            adjustHistory: false,
            animated: false,
            force: true,
            components: [
                new ComponentWithProperties(PaymentPendingView, {
                    server: webshopManager.server,
                    paymentId,
                    cancel,
                    finishedHandler: function (navigationActions: NavigationActions & { popup: ReturnType<typeof usePopup> }, payment: Payment | null) {
                        if (payment && payment.status === PaymentStatus.Succeeded) {
                            if (!navigationActions.popup) {
                                console.log('Presenting order by replacing current view');

                                // We are not in a popup/sheet on mobile
                                // So replace with a force instead of dimissing
                                present({
                                    components: [
                                        new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true }),
                                    ],
                                    replace: 1,
                                    force: true,
                                }).catch(console.error);
                            }
                            else {
                                // In popup/sheet on desktop
                                // Desktop: push
                                navigationActions.dismiss({ force: true, animated: true }).catch(console.error);
                                present({
                                    components: [
                                        new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true }),
                                    ],
                                }).catch(console.error);
                            }
                        }
                        else {
                            navigationActions.dismiss({ force: true }).catch(console.error);

                            // Force reload webshop (stock will have changed: prevent invalidating the cart)
                            // Update stock in background
                            webshopManager.reload().catch((e) => {
                                console.error(e);
                            });

                            new CenteredMessage('Betaling mislukt', 'De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.').addCloseButton(undefined, async () => {
                                await resumeStep('/checkout/payment');
                            }).show();
                        }
                    },
                }),
            ],
            modalDisplayStyle: 'sheet', // warning: if changing to popup: present won't work on mobile devices in the finishedhandler (because this is deactivated -> no parents)!
            url: path.join('/'),
        }).catch(console.error);
    }
    else if (path.length === 2 && path[0] === 'checkout') {
        resumeStep('/' + path.join('/'), false).catch((e) => {
            console.error(e);
        });
    }
    else if (path.length === 1 && path[0] === 'cart' && cartEnabled.value) {
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

            const getComponentAndSetUrl = async () => {
                const component = await nextStep.getComponent();
                component.provide.reactive_navigation_url = nextStep.url;
                return component;
            };

            waitingComponents.push(getComponentAndSetUrl());
            step = nextStep;
        }
        catch (e) {
            // Possible invalid checkout -> stop here
            break;
        }
    }

    const components = await Promise.all(waitingComponents);
    openCart(animated, components);
}

onDeactivated(() => {
    // For an unknown reason, activated is also called when the view is displayed for the first time
    // so we need to only start setting the url when we were deactivated first
    visible.value = false;
});

onBeforeUnmount(() => {
    GlobalEventBus.removeListener(this);
});

onActivated(() => {
    visible.value = true;
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.webshop-view {
    /*display: flex;
    flex-direction: column;
    min-height: 100vh;
    box-sizing: border-box;
    min-height: calc(var(--vh, 1vh) * 100);*/
    --box-width: 600px;

    .webshop-banner {
        // height: 0px;
        // width: 100%;
        margin: 0 auto;
        // padding-bottom: 370 / 720 * 100%;
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-bottom: 30px;
        margin-top: 0px;
        position: relative;

        @media (max-width: 801px) {
            margin-bottom: 20px;
        }

        img {
            // position: absolute;
            border-radius: $border-radius;
            height: auto;
            width: 100%;
            display: block;
        }
    }

    .webshop-layout {
        max-width: 800px;
        margin: 0 auto;
        padding-bottom: 100px;

        .full-product-box {
            background: $color-background;
            --color-current-background: #{$color-background};
            --color-current-background-shade: #{$color-background-shade};
            box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05), 0px 20px 50px $color-shadow, inset 0px 0px 0px 1px $color-shadow;
            border-radius: $border-radius-modals;
            overflow: hidden;
            position: relative;
            z-index: 0;

            @media (max-width: 550px) {
                margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
                border-radius: 0;
            }

            // Reset view insets
            --st-safe-area-top: 0px;
            --st-safe-area-bottom: 0px;
            --st-safe-area-left: 0px;
             --st-safe-area-right: 0px;
            --keyboard-height: 0px;
            --bottom-padding: 0px;

            > .st-view > main{
                // Disable scroll view
                overflow: hidden;
                overscroll-behavior: auto;
            }
        }

        &.Default {
            > .products hr {
                --st-horizontal-padding: 0px;
            }
        }

        &.Split {
            > .products {
                padding: 40px var(--st-horizontal-padding, 20px) 30px var(--st-horizontal-padding, 20px);

                background: $color-background;
                --color-current-background: #{$color-background};
                --color-current-background-shade: #{$color-background-shade};
                box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05), 0px 20px 50px $color-shadow, inset 0px 0px 0px 1px $color-shadow;
                border-radius: $border-radius-modals;
                overflow: hidden;
                position: relative;
                z-index: 0;

                @media (max-width: 550px) {
                    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
                    border-radius: 0;
                }
            }

            @media (min-width: 1000px) {
                display: grid;
                grid-template-columns: 1fr 1fr;
                align-items: start;
                gap: 30px;
                max-width: 1200px;
                margin: 0 auto;

                .webshop-header {
                    > h1:first-child {
                        padding-top: 40px;
                    }
                }

                //> .full-product-box {
                    // position: sticky;
                    // top: 0px;
                //}
            }

            @media (min-width: 1200px) {
                gap: 50px;
            }
        }
    }

    .webshop-header {
        --st-horizontal-padding: 0px;
        padding-bottom: 30px;

        h1 {
            @extend .style-title-semihuge;
            padding-bottom: 10px;
        }

        .description {
            @extend .style-description;
            white-space: pre-wrap;
        }
    }

    .stamhoofd-footer {
        padding-top: 15px;
        @extend .style-description-small;

        a {
            white-space: normal;
            text-overflow: initial;
            height: auto;
            line-height: 1.4;
        }

        strong {
            color: $color-primary-original;
        }
    }
}
</style>
