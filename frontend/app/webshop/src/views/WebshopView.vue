<template>
    <section class="st-view shade webshop-view">
        <STNavigationBar :large="true">
            <template slot="left">
                <OrganizationLogo :organization="organization" :webshop="webshop" />
            </template>

            <template slot="right">
                <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>Terug naar website</span>
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
                    <div v-if="webshop.meta.description.html" class="description style-wysiwyg" v-html="webshop.meta.description.html" />
                    <p v-else-if="webshop.meta.description.text" class="description" v-text="webshop.meta.description.text" />

                    <p v-if="isTrial" class="error-box">
                        Dit is een demo webshop
                    </p>

                    <p v-if="showOpenAt" class="info-box">
                        Bestellen kan vanaf {{ webshop.meta.openAt | dateTime }}
                    </p>
                    <p v-else-if="closed" class="info-box">
                        Bestellingen zijn gesloten
                    </p>
                    <p v-else-if="almostClosed" class="info-box">
                        Bestellen kan tot {{ webshop.meta.availableUntil | time }}
                    </p>
                    <p v-if="categories.length == 0 && products.length == 0" class="info-box">
                        Momenteel is er niets beschikbaar.
                    </p>
                </header>

                <template v-if="!closed || showOpenAt">
                    <FullPageProduct v-if="products.length === 1" :product="products[0]" :webshop="webshop" :cart="cart" :save-handler="onAddItem" />
                    <div v-else class="products">
                        <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :cart="cart" :save-handler="onAddItem" :is-last="index === categories.length - 1" />
                        <ProductGrid v-if="categories.length == 0" :products="products" :webshop="webshop" :cart="cart" :save-handler="onAddItem" />
                    </div>
                </template>
            </div>

            <div class="legal-footer">
                <hr class="style-hr">
                <div>
                    <aside>
                        {{ organization.meta.companyName || organization.name }}{{ organization.meta.VATNumber || organization.meta.companyNumber ? (", "+(organization.meta.VATNumber || organization.meta.companyNumber)) : "" }}
                        <template v-if="organization.website">
                            -
                        </template>
                        <a v-if="organization.website" :href="organization.website" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                            Website
                        </a>
                        
                        <template v-for="policy in policies">
                            -
                            <a :key="policy.id" :href="policy.calculatedUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                                {{ policy.name }}
                            </a>
                        </template>

                        <template v-if="privacyUrl">
                            -
                        </template>

                        <a v-if="privacyUrl" :href="privacyUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                            Privacyvoorwaarden
                        </a>

                        <br>
                        {{ organization.meta.companyAddress || organization.address }}
                    </aside>
                    <div>
                        <a v-if="hasTickets" :href="'https://'+$t('shared.domains.marketing')+'/ticketverkoop'">Ticketverkoop via <Logo /></a>
                        <a v-else :href="'https://'+$t('shared.domains.marketing')+'/webshops'">Webshop via <Logo /></a>
                    </div>
                </div>
            </div>
        </main>
    </section>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CategoryBox, CenteredMessage, Checkbox, GlobalEventBus, LoadingView, Logo, OrganizationLogo, PaymentPendingView, ProductGrid, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { CartItem, Payment, PaymentStatus, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../classes/CheckoutManager';
import { WebshopManager } from '../classes/WebshopManager';
import CartView from './checkout/CartView.vue';
import { CheckoutStep, CheckoutStepsManager } from './checkout/CheckoutStepsManager';
import FullPageProduct from "./FullPageProduct.vue";
import OrderView from './orders/OrderView.vue';
import TicketView from "./orders/TicketView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        CategoryBox,
        ProductGrid,
        OrganizationLogo,
        Logo,
        FullPageProduct
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        time: Formatter.time.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    metaInfo() {
        return {
            title: WebshopManager.webshop.meta.name,
            titleTemplate: '%s | '+WebshopManager.organization.name,
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: WebshopManager.webshop.meta.description.text,
                },
                {
                    hid: 'og:site_name',
                    name: 'og:site_name',
                    content: WebshopManager.organization.name
                },
                {
                    hid: 'og:title',
                    name: 'og:title',
                    content: WebshopManager.webshop.meta.title ?? WebshopManager.webshop.meta.name
                },
                ...(this.bannerImageSrc ? [
                    {
                        hid: 'og:image',
                        name: 'og:image',
                        content: this.bannerImageSrc
                    },
                    {
                        hid: 'og:image:width',
                        name: 'og:image:width',
                        content: this.bannerImageWidth
                    },
                    {
                        hid: 'og:image:height',
                        name: 'og:image:height',
                        content: this.bannerImageHeight
                    },
                    {
                        hid: 'og:image:type',
                        name: 'og:image:type',
                        content: this.bannerImageSrc.endsWith(".png") ? 'image/png' : 'image/jpeg'
                    },
                ] : [])
            ]
        }
    }
})
export default class WebshopView extends Mixins(NavigationMixin){
    CheckoutManager = CheckoutManager
    CheckoutStepsManager = CheckoutStepsManager
    WebshopManager = WebshopManager
    visible = true

    get organization() {
        return WebshopManager.organization
    }
    
    get webshop() {
        return WebshopManager.webshop
    }

    get cartEnabled() {
        return this.webshop.shouldEnableCart
    }

    get hasTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.Tickets
    }

    get policies() {
        return this.webshop.meta.policies
    }

    get webshopLayout() {
        return this.webshop.meta.layout
    }

    get privacyUrl() {
        if (this.webshop.meta.policies.length > 0) {
            return null
        }
        if (WebshopManager.organization.meta.privacyPolicyUrl) {
            return WebshopManager.organization.meta.privacyPolicyUrl
        }
        if (WebshopManager.organization.meta.privacyPolicyFile) {
            return WebshopManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    get cart() {
        return CheckoutManager.cart
    }

    get cartCount() {
        return CheckoutManager.cart.count
    }

    async openCheckout(animated = true) {
        try {
            // Force a save if nothing changed (to fix timeSlot + updated data)
            const nextStep = await CheckoutStepsManager.getNextStep(undefined, false)
            if (!nextStep) {
                throw new SimpleError({
                    code: "missing_config",
                    message: "Er ging iets mis bij het ophalen van de volgende stap"
                })
            }

            this.present({
                animated,
                adjustHistory: animated,
                components: [
                    new ComponentWithProperties(NavigationController, { 
                        initialComponents: [await nextStep.getComponent()]
                    }),
                ],
                modalDisplayStyle: "popup",
                url: UrlHelper.transformUrl(nextStep.url),
            })
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
    }

    openCart(animated = true, components: ComponentWithProperties[] = [], url?: string) {
        if (!this.cartEnabled && components.length == 0) {
            this.openCheckout(animated).catch(console.error)
            return
        }
        this.present({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    initialComponents: [
                        ...(this.cartEnabled ? [new ComponentWithProperties(CartView)] : []),
                        ...components
                    ] 
                }),
            ],
            modalDisplayStyle: "popup",
            url: UrlHelper.transformUrl(url ?? '/cart')
        })
    }

    get bannerImage() {
        return this.webshop.meta.coverPhoto?.getResolutionForSize(Math.min(document.documentElement.clientWidth - 30, 900), undefined)
    }
    
    get bannerImageWidth() {
        return this.bannerImage?.width
    }

    get bannerImageHeight() {
        return this.bannerImage?.height
    }

    get bannerImageSrc() {
        return this.bannerImage?.file.getPublicPath()
    }

    get isTrial() {
        return this.organization.meta.packages.isWebshopsTrial
    }

    get closed() {
        // 2 minutes in advance already
        return this.webshop.isClosed(2*60*1000) || !this.organization.meta.packages.useWebshops
    }

    get almostClosed() {
        return this.webshop.isClosed(6*60*60*1000) && !this.closed
    }

    get showOpenAt() {
        return this.closed && this.webshop.opensInTheFuture()
    }

    get products() {
        return this.webshop.products.filter(p => !p.hidden)
    }

    get categories() {
        return this.webshop.categories.filter(c => {
            const products = c.productIds.flatMap(id => {
                const product = this.webshop.products.find(p => p.id === id)
                if (product && !product.hidden) {
                    return [product]
                }
                return []
            })
            return products.length > 0
        })
    }
    
    onAddItem(cartItem: CartItem, oldItem: CartItem | null, component) {
        if (this.cartEnabled) {
            cartItem.validate(this.webshop, CheckoutManager.cart)
            if (component) {
                component.dismiss({force: true})
            }

            if (oldItem) {
                CheckoutManager.cart.removeItem(oldItem)
            }
            CheckoutManager.cart.addItem(cartItem)
            CheckoutManager.saveCart()

            this.openCart(true)
            // if (this.products.length === 1) {
            //this.openCart(true)
            // } else {
            //new Toast(cartItem.product.name+" is toegevoegd aan je winkelmandje", "success green").setHide(2000).show()
            // }
        } else {
            CheckoutManager.cart.clear();
            cartItem.validate(this.webshop, CheckoutManager.cart)
            if (component) {
                component.dismiss({force: true})
            }

            CheckoutManager.cart.addItem(cartItem)
            CheckoutManager.saveCart()
            this.openCheckout(true).catch(console.error)
        }
    }

    mounted() {
        const currentPath = UrlHelper.shared.getPath({ removeLocale: true })
        const path = UrlHelper.shared.getParts();
        const params = UrlHelper.shared.getSearchParams()
        UrlHelper.shared.clear()

        UrlHelper.setUrl("/")

        if (path.length == 2 && path[0] == 'order') {
            const orderId = path[1];
            this.present({
                animated: false,
                adjustHistory: false,
                components: [
                    new ComponentWithProperties(OrderView, { orderId })
                ]
            })
        } else if (path.length == 2 && path[0] == 'tickets') {
            const secret = path[1];
            this.present({
                animated: false,
                adjustHistory: false,
                components: [
                    new ComponentWithProperties(TicketView, { secret })
                ]
            })
        } else if (path.length == 1 && path[0] == 'payment' && params.get("id")) {
            const paymentId = params.get("id")
            const cancel = params.get("cancel") === "true"
            const me = this
            this.present({
                adjustHistory: false,
                animated: false,
                force: true,
                components: [
                    new ComponentWithProperties(PaymentPendingView, { 
                        server: WebshopManager.server, 
                        paymentId,
                        cancel,
                        finishedHandler: function(this: NavigationMixin, payment: Payment | null) {
                            if (payment && payment.status == PaymentStatus.Succeeded) {
                                if (this.modalNavigationController) {
                                    // We are not in a popup: on mobile
                                    // So replace with a force instead of dimissing
                                    this.present({
                                        components: [
                                            new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true })
                                        ],
                                        replace: 1,
                                        force: true
                                    })
                                } else {
                                    // Desktop: push
                                    this.present({
                                        components: [
                                            new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true })
                                        ]
                                    })
                                    this.dismiss({force: true})
                                }
                            } else {
                                this.dismiss({force: true})
                                new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.").addCloseButton(undefined, async () => {
                                    await me.resumeStep('/checkout/payment');
                                }).show()
                            }
                        } 
                    })
                ],
                modalDisplayStyle: "sheet" // warning: if changing to popup: this.present won't work on mobile devices in the finishedhandler (because this is deactivated -> no parents)!
            })
        } else if (path.length == 2 && path[0] == 'checkout') {
            this.resumeStep('/' + path.join('/'), false).catch(e => {
                console.error(e)
            })
        } else if (path.length == 1 && path[0] == 'cart' && this.cartEnabled) {
            this.openCart(false)
        }
    }

    async resumeStep(destination: string, animated = true) {
        // Quickly recreate all steps
        let step: CheckoutStep | undefined = undefined
        const waitingComponents: Promise<ComponentWithProperties>[] = []

        while (!step || step.url !== destination) {
            try {
                const nextStep = await CheckoutStepsManager.getNextStep(step?.id)
                if (!nextStep) {
                    break;
                }
                waitingComponents.push(nextStep.getComponent())
                step = nextStep
            } catch (e) {
                // Possible invalid checkout -> stop here
                break;
            }
        }

        const components = await Promise.all(waitingComponents)
        this.openCart(animated, components, step?.url)
    }

    deactivated() {
        // For an unknown reason, activated is also called when the view is displayed for the first time
        // so we need to only start setting the url when we were deactivated first
        this.visible = false
    }

    beforeDestroy() {
        GlobalEventBus.removeListener(this)
    }

    activated() {
        this.visible = true
    }
}
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
            --keyboard-height: 0px;
            --bottom-padding: 0px;

            > .st-view > main{
                // Disable scroll view
                overflow: hidden;
            }
        }

        &.Default {
            > .products {
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

                > .full-product-box {
                    // position: sticky;
                    // top: 0px;
                }
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
            @extend .style-huge-title-1;
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