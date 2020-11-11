<template>
    <section class="padded-view">
        <div class="webshop-view">
            <figure v-if="bannerImageSrc" class="webshop-banner">
                <img :src="bannerImageSrc" :width="bannerImageWidth" :height="bannerImageHeight">
            </figure>

            <main>
                <h1>{{ webshop.meta.title || webshop.meta.name }}</h1>
                <p v-text="webshop.meta.description" />

                <p v-if="webshop.categories.length == 0 && webshop.products.length == 0" class="warning-box">
                    Er zijn nog geen artikels toegevoegd aan deze webshop, kom later eens terug.
                </p>

                <CategoryBox v-for="category in webshop.categories" :key="category.id" :category="category" :webshop="webshop" />
                <ProductGrid v-if="webshop.categories.length == 0" :products="webshop.products" />
            </main>
        </div>
    </section>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,LoadingView, PaymentPendingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { Payment, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";
import { GlobalEventBus } from '../classes/EventBus';

import { WebshopManager } from '../classes/WebshopManager';
import CartView from './checkout/CartView.vue';
import { CheckoutStepsManager, CheckoutStepType } from './checkout/CheckoutStepsManager';
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
        ProductGrid
    },
    filters: {
        price: Formatter.price
    }
})
export default class WebshopView extends Mixins(NavigationMixin){
    get webshop() {
        return WebshopManager.webshop
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

    canSetUrl = false

    mounted() {
        GlobalEventBus.addListener(this, "checkout", async () => {
            console.log("goto checkout")
            const nextStep = CheckoutStepsManager.getNextStep(undefined, true)

            if (!nextStep) {
                // Not possible
                new Toast("Bestellen is nog niet mogelijk omdat nog enkele instellingen ontbreken.", "error").show()
                return;
            }

            const comp = await nextStep.getComponent();
            this.show(new ComponentWithProperties(comp, {}))
        })

        ComponentWithProperties.debug = true
        const path = this.webshop.removeSuffix(window.location.pathname.substring(1).split("/"));
        if (path.length == 2 && path[0] == 'order') {
            // tood: password reset view
            const orderId = path[1];
            this.navigationController!.push(new ComponentWithProperties(OrderView, { orderId }), false);
        } else if (path.length == 1 && path[0] == 'payment') {
            this.navigationController!.push(new ComponentWithProperties(PaymentPendingView, { server: WebshopManager.server ,finishedHandler: (payment: Payment | null) => {
                if (payment && payment.status == PaymentStatus.Succeeded) {
                    this.navigationController!.push(new ComponentWithProperties(OrderView, { paymentId: payment.id, success: true }), true, 1);
                } else {
                    this.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.", "error").addCloseButton().show()
                    this.resumeStep(CheckoutStepType.Payment)
                }
            } }), false);
        } else if (path.length == 2 && path[0] == 'checkout') {
            const stepName = Formatter.capitalizeFirstLetter(path[1])
            if (Object.values(CheckoutStepType).includes(stepName as any)) {
                const step = stepName as CheckoutStepType
                this.resumeStep(step, false)
            }
        } else if (path.length == 1 && path[0] == 'cart') {
            HistoryManager.setUrl(this.webshop.getUrlSuffix())
            this.present(new ComponentWithProperties(CartView, {}).setDisplayStyle("popup"))
        } else {
            HistoryManager.setUrl(this.webshop.getUrlSuffix())
        }

        this.$nextTick(() => {
            this.canSetUrl = true
        })
    }

    resumeStep(destination: CheckoutStepType, animated = true) {
         // Quickly recreate all steps
        let step: CheckoutStepType | undefined = undefined
        const components: Promise<any>[] = []
        while (step != destination) {
            const nextStep = CheckoutStepsManager.getNextStep(step, true)
            if (!nextStep) {
                break;
            }
            components.push(nextStep.getComponent())
            step = nextStep.type
        }

        Promise.all(components).then(comp => {
            const replaceWith = comp.map(component => new ComponentWithProperties(component, {}))
            this.navigationController!.push(replaceWith[replaceWith.length - 1], animated, 0, false, replaceWith.slice(0, replaceWith.length - 1))
        }).catch(e => {
            console.error(e)
        })
    }

    deactivated() {
        console.log("deactivated")
        // For an unknown reason, activated is also called when the view is displayed for the first time
        // so we need to only start setting the url when we were deactivated first
        this.canSetUrl = true

    }

    beforeDestroy() {
        GlobalEventBus.removeListener(this)
    }

    activated() {
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
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    box-sizing: border-box;
    min-height: calc(var(--vh, 1vh) * 100);

    .webshop-banner {
        height: 300px;
        background: $color-gray;
        border-radius: $border-radius;
        margin-bottom: 40px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
        }

        @media (max-width: 800px) {
            border-radius: 0;
            margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
            margin-bottom: 30px;
            height: calc(100vw / 720 * 300);

            img {
                border-radius: 0;
            }
        }
    }

    > main {
        @extend .main-text-container;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 15px;

            + p {
                 white-space: pre-wrap;
            }
        }
    }

    padding: 0 var(--st-horizontal-padding, 40px) var(--st-vertical-padding, 20px) var(--st-horizontal-padding, 40px);
    
    @media (min-width: 801px) {
        max-width: 800px;
        margin: 0 auto;
        min-height: auto;
    }
}
</style>