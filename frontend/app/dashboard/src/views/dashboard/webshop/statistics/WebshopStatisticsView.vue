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


            <div class="stats-grid">
                <STInputBox title="Omzet">
                    <p class="style-price-big">
                        <span>
                            {{ loading ? '-' : formatPrice(totalRevenue) }}
                        </span>
                    </p>
                </STInputBox>

                <STInputBox title="Bestellingen">
                    <p class="style-price-big">
                        <span>
                            {{ loading ? '-' : totalOrders }}
                        </span>
                    </p>
                </STInputBox>

                <STInputBox title="Gemiddeld bestelbedrag">
                    <p class="style-price-big">
                        <span>
                            {{ loading ? '-' : formatPrice(averagePrice) }}
                        </span>
                    </p>
                </STInputBox>
            </div>

            <template v-if="hasTickets">
                <hr>
                <h2>Tickets</h2>

                <div class="stats-grid">
                    <STInputBox title="Verkocht">
                        <p class="style-price-big">
                            <span>
                                {{ loading ? '-' : totalTickets }}
                            </span>
                        </p>
                    </STInputBox>

                    <STInputBox title="Gescand">
                        <p class="style-price-big">
                            <span>
                                {{ loading ? '-' : totalScannedTickets }}
                            </span>
                        </p>
                    </STInputBox>
                </div>
            </template>

            <template v-if="hasVouchers">
                <hr>
                <h2>Vouchers</h2>

                <div class="stats-grid">
                    <STInputBox title="Verkocht">
                        <p class="style-price-big">
                            <span>
                                {{ loading ? '-' : totalVouchers }}
                            </span>
                        </p>
                    </STInputBox>

                    <STInputBox title="Gescand">
                        <p class="style-price-big">
                            <span>
                                {{ loading ? '-' : totalScannedVouchers }}
                            </span>
                        </p>
                    </STInputBox>
                </div>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STInputBox,Toast } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, Spinner } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { Order, OrderStatus, ProductType, TicketPrivate, WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { WebshopManager } from '../WebshopManager';


@Component({
    components: {
        Checkbox,
        STNavigationBar,
        BackButton,
        Spinner,
        STInputBox
    }
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

    get hasTickets() {
        return this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None
    }

    get hasVouchers() {
        return this.webshopManager.preview.meta.ticketType === WebshopTicketType.Tickets
    }

    loading = false

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    totalRevenue = 0
    totalOrders = 0
    averagePrice = 0
    totalTickets = 0
    totalScannedTickets = 0

    totalVouchers = 0
    totalScannedVouchers = 0

    mounted() {
        this.reload().catch(console.error)

        // Set url
        HistoryManager.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/statistics")
        document.title = this.preview.meta.name+" - Statistieken"
    }

    async reload() {
        this.loading = true
        try {
            await this.webshopManager.streamOrders((order: Order) => {
                if (order.status !== OrderStatus.Canceled) {
                    this.totalRevenue += order.data.totalPrice
                    this.totalOrders += 1
                    this.averagePrice = Math.round(this.totalRevenue / this.totalOrders)
                }
            })

            if (this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None) {
                await this.webshopManager.streamTickets((ticket: TicketPrivate) => {
                    (async () => {
                        let type: ProductType = ProductType.Ticket

                        // determine ticket type
                        if (ticket.itemId !== null) {
                            const order = await this.webshopManager.getOrderFromDatabase(ticket.orderId)
                            if (order) {
                                const item = order.data.cart.items.find(i => i.id === ticket.itemId)
                                if (item) {
                                    type = item.product.type
                                }
                            }
                        }

                        if (type === ProductType.Voucher) {
                            if (ticket.scannedAt) {
                                this.totalScannedVouchers++
                            }
                            this.totalVouchers += 1
                        } else {
                            if (ticket.scannedAt) {
                                this.totalScannedTickets++
                            }
                            this.totalTickets += 1
                        }
                    })().catch(console.error)
                })
            }

            
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
