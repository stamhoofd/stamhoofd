<template>
    <div class="st-view webshop-statistics-view background">
        <STNavigationBar>
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
    
        <main>
            <h1>
                Statistieken
            </h1>
            <p class="info-box">
                Geannuleerde bestellingen zijn niet inbegrepen.
            </p>

            <hr>

            <div class="stats-grid">
                <div class="container">
                    <h2 class="style-with-button">
                        <span>Omzet</span>
                    </h2>
                    <p class="style-price-big">
                        {{ loading ? '-' : formatPrice(totalRevenue) }}
                    </p>
                </div>

                <div class="container">
                    <h2 class="style-with-button">
                        <span>Bestellingen</span>
                    </h2>
                    <p class="style-price-big">
                        {{ loading ? '-' : totalOrders }}
                    </p>
                </div>

                <div class="container">
                    <h2 class="style-with-button">
                        <span>Gem. bestelbedrag</span>
                    </h2>
                    <p class="style-price-big">
                        {{ loading ? '-' : formatPrice(averagePrice) }}
                    </p>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, Spinner } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { Order, OrderStatus } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { WebshopManager } from '../WebshopManager';


@Component({
    components: {
        Checkbox,
        STNavigationBar,
        BackButton,
        Spinner,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
    },
    directives: { Tooltip },
})
export default class WebshopStatisticsView extends Mixins(NavigationMixin) {
    @Prop()
    webshopManager: WebshopManager

    get preview() {
        return this.webshopManager.preview
    }

    get webshop() {
        return this.webshopManager.webshop
    }

    loading = false

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    totalRevenue = 0
    totalOrders = 0
    averagePrice = 0

    mounted() {
        this.reload().catch(console.error)
    }

    async reload() {
        this.loading = true
        try {
            await this.webshopManager.streamOrders((order: Order) => {
                if (order.status !== OrderStatus.Canceled) {
                    this.totalRevenue += order.data.totalPrice
                    this.totalOrders += 1
                    this.averagePrice = this.totalRevenue / this.totalOrders
                }
            })
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loading = false
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.webshop-statistics-view {
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr) );
        gap: 30px 15px;
    }
}
</style>
