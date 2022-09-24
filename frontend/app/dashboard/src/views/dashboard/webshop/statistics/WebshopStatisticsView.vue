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

            <div class="graph-grid">
                <GraphView title="Omzet" :formatter="priceFormatter()" :sum="true" :options="dateOptions" :load="loadRevenueGraph" />

                <template v-if="hasTickets && (scanDateOptions === null || scanDateOptions.length > 0)">
                    <GraphView title="Gescande tickets" :formatter="formatNumber" :sum="true" :options="scanDateOptions" :load="loadScanGraph" />
                </template>
            </div>

            <hr>

            <div class="stats-grid">
                <STInputBox v-if="false" title="Omzet">
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
import { BackButton, Checkbox, DateOption, GraphView,Spinner, STInputBox, STNavigationBar, Toast } from "@stamhoofd/components";
import { AppManager, UrlHelper } from '@stamhoofd/networking';
import { Category, Graph, Order, OrderStatus, ProductType, TicketPrivate, WebshopTicketType } from "@stamhoofd/structures";
import { GraphData } from "@stamhoofd/structures/esm/dist";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from '../WebshopManager';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        BackButton,
        Spinner,
        STInputBox,
        GraphView
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

    priceFormatter() {
        return Formatter.price.bind(Formatter)
    }

    async createGroupedChart(range: DateOption, dataGenerator: (callback: (total: number, date: Date) => void) => Promise<void>): Promise<Graph> {
        // Keep a Set of all order Id's to prevent duplicate orders (in case an order gets updated, we'll receive it multiple times)
        const orderByDate = new Map<string, {total: number, date: Date}>()

        // todo: determine grouping method
        let groupingMethod: (date: Date) => string = Formatter.dateIso.bind(Formatter)
        let groupingInterval: any = { days: 1 }
        let groupingLabel = Formatter.date.bind(Formatter)

        // If range is larger than 2 month: group by week
        const days = (range.range.end.getTime() - range.range.start.getTime()) / (1000 * 60 * 60 * 24)
        
        if (days <= 3) {
            // Group per hour
            groupingMethod = (date: Date) => {
                return Formatter.dateIso(date) + " " + date.getHours()
            }
            groupingInterval = { hours: 1 }
            groupingLabel = (date: Date) => {
                return Formatter.date(date) + " " + date.getHours() + ":00"
            }
            range.range.start = Formatter.luxon(range.range.start).startOf("hour").toJSDate()
        }
        
        if (days <= 2) {
            // Group per half hour
            groupingMethod = (date: Date) => {
                return Formatter.dateIso(date) + " " + date.getHours() + ":" + (date.getMinutes() >= 30 ? "30" : "00")
            }
            groupingInterval = { minutes: 30 }
            groupingLabel = (date: Date) => {
                return Formatter.date(date) + " " + date.getHours() + ":" + (date.getMinutes() >= 30 ? "30" : "00")
            }
            range.range.start = Formatter.luxon(range.range.start).startOf("hour").toJSDate()
        }

        if (days > 60) {
            groupingMethod = (date: Date) => {
                const lux = Formatter.luxon(date)
                return lux.year + "/" + lux.weekNumber
            }
            groupingLabel = (date: Date) => {
                const lux = Formatter.luxon(date)
                const start = lux.startOf("week");
                return "Week van " + Formatter.date(start.toJSDate(), true)
            }
            groupingInterval = { days: 7 }

            // Modify range.range.start to be a monday
            range.range.start = Formatter.luxon(range.range.start).startOf("week").startOf("day").toJSDate()
        }

        if (days > 366) {
            groupingMethod = (date: Date) => {
                const lux = Formatter.luxon(date)
                return lux.year + "-" + lux.month
            }
            groupingLabel = (date: Date) => {
                const lux = Formatter.luxon(date)
                return Formatter.capitalizeFirstLetter(Formatter.month(lux.month)) + " " + lux.year
            }
            groupingInterval = { months: 1 }
            range.range.start = Formatter.luxon(range.range.start).startOf("month").startOf("day").toJSDate()
        }

        await dataGenerator((total: number, date: Date) => {
            const group = groupingMethod(date)
            const existing = orderByDate.get(group)
            if (existing) {
                existing.total += total
            } else {
                orderByDate.set(group, {
                    total,
                    date
                })
            }
        })

        // Sort by date

        // Now add missing dates to data
        let startDate = Formatter.luxon(range.range.start); // Formatter.luxon(new Date(Math.min(range.range.start.getTime(), data[0]?.date.getTime())))
        const endDate = Formatter.luxon(range.range.end); // Formatter.luxon(new Date(Math.max(range.range.end.getTime(), data[data.length-1]?.date.getTime())))

        while (startDate.toJSDate() < endDate.toJSDate()) {
            startDate = startDate.plus(groupingInterval)
            const jsDate = startDate.toJSDate()

            if (!orderByDate.has(groupingMethod(jsDate))) {
                orderByDate.set(groupingMethod(jsDate), {
                    total: 0,
                    date: jsDate
                })
            }
        }

        const data: {total: number, date: Date}[] = [...orderByDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
        data.sort((a, b) => a.date.getTime() - b.date.getTime())

        return Graph.create({
            labels: data.map(d => groupingLabel(d.date)),
            data: [
                GraphData.create({
                    label: "Omzet",
                    values: data.map(d => d.total),
                })
            ]
        })
    }

    async loadRevenueGraph(range: DateOption): Promise<Graph> {
        console.log('Loading revenue graph');
        const orderIds = new Set<string>()

        return await this.createGroupedChart(range, async (callback) => {
            await this.webshopManager.streamOrders((order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                    // Check in range
                    if (order.createdAt < range.range.start || order.createdAt > range.range.end) {
                        return
                    }

                    orderIds.add(order.id)
                    callback(order.data.totalPrice, order.createdAt)
                }
            }, false)
        });
    }

    async loadScanGraph(range: DateOption): Promise<Graph> {
        console.log('Loading scan graph');

        return await this.createGroupedChart(range, async (callback) => {
            await this.webshopManager.streamTickets((ticket: TicketPrivate) => {
                if (ticket.scannedAt) {
                    return callback(1, ticket.scannedAt)
                }
            }, false)
        });
    }

    

    dateOptions: DateOption[] | null = null
    scanDateOptions: DateOption[] | null = null

    buildTicketDateRangeOptions() {
        const options: DateOption[] = []
        // Fill options here
        if (this.firstScannedTicketDate && this.lastScannedTicketDate) {
            options.push(new DateOption("Per uur", { 
                start: Formatter.luxon(this.firstScannedTicketDate).startOf('hour').toJSDate(), 
                end: Formatter.luxon(this.lastScannedTicketDate).endOf('hour').toJSDate()
            }))
        }
        return options;
    }

    buildDateRangeOptions() {
        const options: DateOption[] = []
        const reference = new Date()
        reference.setHours(23, 59, 59, 999)

        // Fill options here
        if (this.firstOrderDate && this.lastOrderDate) {
            options.push(new DateOption("Alles", { 
                start: Formatter.luxon(this.firstOrderDate).startOf('day').toJSDate(), 
                end: Formatter.luxon(this.lastOrderDate).endOf('day').toJSDate()
            }))
        }

        // Fill options here
        const year = new Date(reference)
        year.setFullYear(reference.getFullYear() - 1)
        options.push(new DateOption("Afgelopen jaar", { start: year, end: reference }))

        // Fill options here
        const months3 = new Date(reference)
        months3.setMonth(reference.getMonth() - 3)
        options.push(new DateOption("Afgelopen 3 maanden", { start: months3, end: reference }))

        // Fill options here
        const months6 = new Date(reference)
        months6.setMonth(reference.getMonth() - 6)
        options.push(new DateOption("Afgelopen 6 maanden", { start: months6, end: reference }))

        // Fill options here
        const month = new Date(reference)
        month.setMonth(reference.getMonth() - 1)
        options.push(new DateOption("Afgelopen maand", { start: month, end: reference }))

        return options
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

    formatNumber(number: number) {
        return number.toString()
    }

    totalRevenue = 0
    totalOrders = 0
    averagePrice = 0
    totalTickets = 0
    totalScannedTickets = 0
    firstOrderDate: Date | null = null
    lastOrderDate: Date | null = null
    firstScannedTicketDate: Date | null = null
    lastScannedTicketDate: Date | null = null

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
            this.firstOrderDate = null
            this.lastOrderDate = null
            this.firstScannedTicketDate = null
            this.lastScannedTicketDate = null

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
                    if (ticket.scannedAt) {
                        if (!this.firstScannedTicketDate || ticket.scannedAt < this.firstScannedTicketDate) {
                            this.firstScannedTicketDate = ticket.scannedAt
                        }
                        if (!this.lastScannedTicketDate || ticket.scannedAt > this.lastScannedTicketDate) {
                            this.lastScannedTicketDate = ticket.scannedAt
                        }
                    }

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

                    // Don't add directly, because we don't want to include ticket for canceled / deleted orders
                    const orderId = ticket.orderId
                    const orderItemMap: Map<string, { scanned: number, total: number }> = orderTicketMap.get(orderId) ?? new Map()
                    orderItemMap.set('', {
                        scanned: (orderItemMap.get('')?.scanned ?? 0) + (ticket.scannedAt ? 1 : 0),
                        total: (orderItemMap.get('')?.total ?? 0) + 1
                    })
                    orderTicketMap.set(orderId, orderItemMap)
                })
            }

            await this.webshopManager.streamOrders((order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                    orderIds.add(order.id)
                    this.totalRevenue += order.data.totalPrice
                    this.totalOrders += 1

                    if (this.firstOrderDate === null || order.createdAt < this.firstOrderDate) {
                        this.firstOrderDate = order.createdAt
                    }

                    if (this.lastOrderDate === null || order.createdAt > this.lastOrderDate) {
                        this.lastOrderDate = order.createdAt
                    }

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
                            if (itemId === '') {
                                // General order
                                this.totalScannedTickets += counter.scanned
                                this.totalTickets += counter.total
                                continue;
                            }
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

            this.dateOptions = this.buildDateRangeOptions()
            this.scanDateOptions = this.buildTicketDateRangeOptions()
            
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
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr) );
        gap: 0px 15px;
    }

    .graph-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(900px, 1fr) );
       gap: 30px;

       @media (max-width: 1200px) {
            grid-template-columns: 1fr;
       }
    }
}
</style>
