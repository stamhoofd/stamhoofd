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

            <div v-if="!loading && totalByProduct.length > 0" class="container">
                <hr>
                <h2>Per productcombinatie</h2>

                <div class="stats-grid">
                    <STInputBox v-for="(info, index) in totalByProduct" :key="index" :title="info.name">
                        <p class="style-price-big">
                            <span>
                                {{ loading ? '-' : info.amount }}
                            </span>
                        </p>
                        <p class="style-description-small">
                            {{ loading ? '-' : formatPrice(info.price) }}
                        </p>

                        <p v-if="info.description" class="style-description-small pre-wrap" v-text="info.description" />
                    </STInputBox>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Spinner, STInputBox, STNavigationBar, Toast } from "@stamhoofd/components";
import { AppManager, UrlHelper } from '@stamhoofd/networking';
import { Category, Order, OrderStatus, ProductType, TicketPrivate, WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

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

    get categories() {
        return this.webshop?.categories ?? []
    }

    getCategoryProducts(category: Category) {
        return category.productIds.flatMap(id => {
            const product = this.webshop?.products.find(product => product.id === id)
            if (product) {
                return [product]
            }
            return []
        })
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

    totalByProduct: { amount: number, name: string, description: string, price: number }[] = []

    reviewTimer: NodeJS.Timeout | null = null

    mounted() {
        this.reload().catch(console.error)

        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/statistics")
        document.title = this.preview.meta.name+" - Statistieken"
    }

    async reload() {
        this.loading = true
        try {
            this.totalByProduct = []
            this.totalRevenue = 0
            this.totalOrders = 0
            this.averagePrice = 0
            this.totalTickets = 0
            this.totalScannedTickets = 0
            this.totalVouchers = 0
            this.totalScannedVouchers = 0

            const productMap: Map<string, { amount: number, name: string, description: string, price: number }> = new Map()

            // Keep a Set of all order Id's to prevent duplicate orders (in case an order gets updated, we'll receive it multiple times)
            const orderIds = new Set<string>()

            await this.webshopManager.loadWebshopIfNeeded(false)

            /**
             * Count the tickets per order item (we need to order item type to know if it is a voucher or a ticket)
             */
            const orderTicketMap: Map<string, Map<string, { scanned: number, total: number }>> = new Map()

            if (this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None) {
                await this.webshopManager.streamTickets((ticket: TicketPrivate) => {
                    // determine ticket type
                    if (ticket.itemId !== null) {
                        // Add it to the orderTicketMap
                        const orderId = ticket.orderId
                        const orderItemMap: Map<string, { scanned: number, total: number }> = orderTicketMap.get(orderId) ?? new Map()
                        orderItemMap.set(ticket.itemId, {
                            scanned: (orderItemMap.get(ticket.itemId)?.scanned ?? 0) + (ticket.scannedAt ? 1 : 0),
                            total: (orderItemMap.get(ticket.itemId)?.total ?? 0) + 1
                        })
                        orderTicketMap.set(orderId, orderItemMap)
                        return
                    }

                    // A general ticket for an order
                    if (ticket.scannedAt) {
                        this.totalScannedTickets++
                    }
                    this.totalTickets += 1
                })
            }

            await this.webshopManager.streamOrders((order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                    orderIds.add(order.id)
                    this.totalRevenue += order.data.totalPrice
                    this.totalOrders += 1

                    for (const item of order.data.cart.items) {
                        const code = item.codeWithoutFields
                        const current = productMap.get(code)
                        if (current) {
                            current.amount += item.amount
                            current.price += item.getPrice(order.data.cart)
                        } else {
                            productMap.set(code, {
                                amount: item.amount,
                                name: item.product.name,
                                description: item.descriptionWithoutFields,
                                price: item.getPrice(order.data.cart),
                            })
                        }
                    }

                    // Check if we have tickets in orderTicketMap
                    const orderItemMap = orderTicketMap.get(order.id)
                    if (orderItemMap) {
                        for (const [itemId, counter] of orderItemMap) {
                            // Find item
                            const item = order.data.cart.items.find(i => i.id === itemId)
                            if (item) {
                                // Check if it is a voucher
                                if (item.product.type === ProductType.Voucher) {
                                    this.totalScannedVouchers += counter.scanned
                                    this.totalVouchers += counter.total
                                } else {
                                    this.totalScannedTickets += counter.scanned
                                    this.totalTickets += counter.total
                                }
                            }
                        }
                    }
                }
            })

            // Sort productmap values by amount and store in totalByProduct
            this.totalByProduct = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount)
            
            if (this.totalOrders > 0) {
                this.averagePrice = Math.round(this.totalRevenue / this.totalOrders)
            }

            
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loading = false

        this.reviewTimer = setTimeout(() => {
            if (!this.loading && (this.totalOrders > 10 || this.totalRevenue > 50000)) {
                AppManager.shared.markReviewMoment()
            }
        }, 5*1000)
    }

    beforeDestroy() {
        if (this.reviewTimer) {
            clearTimeout(this.reviewTimer)
        }
    }
}
</script>

<style lang="scss">
.webshop-statistics-view {
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr) );
        gap: 0px 15px;
    }
}
</style>
