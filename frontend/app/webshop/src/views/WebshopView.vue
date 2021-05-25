<template>
    <section class="st-view webshop-view">
        <STNavigationBar :large="true">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>

            <template slot="right">
                <a v-if="privacyUrl" class="button text limit-space" :href="privacyUrl" target="_blank">
                    <span class="icon privacy" />
                    <span>Privacy</span>
                </a>
                <button class="primary button" @click="openCart(true)">
                    <span class="icon basket" />
                    <span>{{ cartCount }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main class="limit-width">
            <section class="white-top view">
                <main>
                    <figure v-if="bannerImageSrc" class="webshop-banner">
                        <img :src="bannerImageSrc" :width="bannerImageWidth" :height="bannerImageHeight">
                    </figure>
                    <h1>{{ webshop.meta.title || webshop.meta.name }}</h1>
                    <p v-text="webshop.meta.description" />

                    <p v-if="isTrial" class="error-box">
                        Dit is een demo webshop
                    </p>
                </main>
            </section>
            <section class="gray-shadow view">
                <main>
                    <p v-if="webshop.categories.length == 0 && webshop.products.length == 0" class="warning-box">
                        Er zijn nog geen artikels toegevoegd aan deze webshop, kom later eens terug.
                    </p>

                    <p v-if="closed" class="error-box">
                        Bestellingen zijn gesloten
                    </p>
                    <p v-else-if="almostClosed" class="warning-box">
                        Bestellen kan tot {{ webshop.meta.availableUntil | time }}
                    </p>

                    <template v-if="!closed">
                        <CategoryBox v-for="category in webshop.categories" :key="category.id" :category="category" :webshop="webshop" />
                        <ProductGrid v-if="webshop.categories.length == 0" :products="webshop.products" />
                    </template>

                    <p class="stamhoofd-footer">
                        <a href="https://www.stamhoofd.be" target="_blank" class="button text">Webshop door <strong>Stamhoofd</strong>, op maat van verenigingen</a>
                    </p>
                </main>
            </section>
        </main>
    </section>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ComponentWithProperties, HistoryManager, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,GlobalEventBus,LoadingView, OrganizationLogo,PaymentPendingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { Payment, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../classes/CheckoutManager';
import { WebshopManager } from '../classes/WebshopManager';
import CartView from './checkout/CartView.vue';
import { CheckoutStep, CheckoutStepsManager, CheckoutStepType } from './checkout/CheckoutStepsManager';
import OrderView from './orders/OrderView.vue';
import CategoryBox from "./products/CategoryBox.vue"
import ProductGrid from "./products/ProductGrid.vue"

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
        OrganizationLogo
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        time: Formatter.time.bind(Formatter)
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

    get privacyUrl() {
        if (WebshopManager.organization.meta.privacyPolicyUrl) {
            return WebshopManager.organization.meta.privacyPolicyUrl
        }
        if (WebshopManager.organization.meta.privacyPolicyFile) {
            return WebshopManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    get cartCount() {
        return CheckoutManager.cart.count
    }

    openCart(animated = true) {
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(CartView) }).setAnimated(animated).setDisplayStyle("popup"))
    }

    get bannerImage() {
        return this.webshop.meta.coverPhoto?.getResolutionForSize(800, undefined)
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
        if (this.webshop.meta.availableUntil && this.webshop.meta.availableUntil.getTime() < new Date().getTime() + 2*60*1000) {
            return true
        }
        return false
    }

    get almostClosed() {
        if (this.webshop.meta.availableUntil && this.webshop.meta.availableUntil.getTime() < new Date().getTime() + 6*60*60*1000) {
            return true
        }
        return false
    }

    canSetUrl = false

    mounted() {
        GlobalEventBus.addListener(this, "checkout", async () => {
            console.log("goto checkout")
            const nextStep = await CheckoutStepsManager.getNextStep(undefined, true)

            if (!nextStep) {
                // Not possible
                new Toast("Bestellen is nog niet mogelijk omdat nog enkele instellingen ontbreken.", "error").show()
                return;
            }

            const comp = await nextStep.getComponent();
            if (this.visible) {
                this.show(new ComponentWithProperties(comp, {}).setAnimated(true))
            } else {
                return comp
            }
        })

        ComponentWithProperties.debug = true
        const path = this.webshop.removeSuffix(window.location.pathname.substring(1).split("/"));
        if (path.length == 2 && path[0] == 'order') {
            // tood: password reset view
            const orderId = path[1];
            this.show(new ComponentWithProperties(OrderView, { orderId }).setAnimated(false))
        } else if (path.length == 1 && path[0] == 'payment') {
            this.navigationController!.push(new ComponentWithProperties(PaymentPendingView, { server: WebshopManager.server ,finishedHandler: (payment: Payment | null) => {
                if (payment && payment.status == PaymentStatus.Succeeded) {
                    this.navigationController!.push(new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true }), false, 1);
                } else {
                    this.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.", "error").addCloseButton().show()
                    this.resumeStep(CheckoutStepType.Payment).catch(e => {
                        console.error(e)
                    })
                }
            } }), false);
        } else if (path.length == 2 && path[0] == 'checkout') {
            const stepName = Formatter.capitalizeFirstLetter(path[1])
            if (Object.values(CheckoutStepType).includes(stepName as any)) {
                const step = stepName as CheckoutStepType
                this.resumeStep(step, false).catch(e => {
                    console.error(e)
                })
            }
        } else if (path.length == 1 && path[0] == 'cart') {
            HistoryManager.setUrl(this.webshop.getUrlSuffix())
            this.openCart(false)
        } else {
            HistoryManager.setUrl(this.webshop.getUrlSuffix())
        }

        this.$nextTick(() => {
            this.canSetUrl = true
        })
    }

    async resumeStep(destination: CheckoutStepType, animated = true) {
         // Quickly recreate all steps
        let step: CheckoutStepType | undefined = undefined
        const components: Promise<any>[] = []

        while (step != destination) {
            try {
                const nextStep = await CheckoutStepsManager.getNextStep(step)
                if (!nextStep) {
                    break;
                }
                components.push(nextStep.getComponent())
                step = nextStep.type
            } catch (e) {
                // Possible invalid checkout -> stop here
                break;
            }
        }

        const comp = await Promise.all(components)
        if (comp.length == 0) {
            this.openCart(animated)
            return;
        }
        const replaceWith = comp.map(component => new ComponentWithProperties(component, {}))
        this.navigationController!.push(replaceWith[replaceWith.length - 1], animated, 0, false, replaceWith.slice(0, replaceWith.length - 1))
    }

    deactivated() {
        console.log("deactivated")
        // For an unknown reason, activated is also called when the view is displayed for the first time
        // so we need to only start setting the url when we were deactivated first
        this.canSetUrl = true
        this.visible = false

    }

    beforeDestroy() {
        GlobalEventBus.removeListener(this)
    }

    activated() {
        this.visible = true
        console.log("activated "+this.canSetUrl)
        if (this.canSetUrl) {
            console.log("set url!!!")

            // For an unknown reason, we need to set a timer to properly update the URL...
            window.setTimeout(() => {
                HistoryManager.setUrl(this.webshop.getUrlSuffix())
            }, 100);
        }
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

    .webshop-banner {
        height: 0px;
        width: 100%;
        margin: 0 auto;
        padding-bottom: 300 / 720 * 100%;
        background: $color-gray;
        border-radius: $border-radius;
        margin-bottom: 30px;
        margin-top: -20px;
        position: relative;

        @media (max-width: 801px) {
            margin-bottom: 20px;
        }

        img {
            position: absolute;
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }
    }

    > main {
        @extend .main-text-container;

        .white-top > main > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 15px;

            + p {
                @extend .style-description;
                white-space: pre-wrap;
            }
        }

        .stamhoofd-footer {
            padding-top: 30px;
            @extend .style-description;

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

    //padding: 0 var(--st-horizontal-padding, 40px) var(--st-vertical-padding, 20px) var(--st-horizontal-padding, 40px);
    
    /*@media (min-width: 801px) {
        max-width: 800px;
        margin: 0 auto;
        min-height: auto;
    }*/
}
</style>