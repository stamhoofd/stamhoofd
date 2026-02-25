<template>
    <div class="st-view webshop-statistics-view background">
        <STNavigationBar />

        <main class="center">
            <h1>
                {{ $t('121c350e-012c-4bf7-a2bc-2c07b7c433c8') }}
            </h1>

            <hr><div class="graph-grid">
                <GraphView :configurations="graphConfigurations" />
            </div>

            <hr><div class="stats-grid">
                <STInputBox :title="$t(`fc1cc5ad-1590-422d-96a5-4523f10fcab1`)">
                    <p class="style-statistic">
                        <span>
                            {{ loading ? '-' : totalOrders }}
                        </span>
                    </p>
                    <p class="style-description-small">
                        {{ loading ? '-' : formatPrice(averagePrice) + ' / bestelling' }}
                    </p>
                </STInputBox>

                <template v-if="hasTickets">
                    <STInputBox :title="$t(`b40d200c-4265-4d58-a7f4-7c2498b062b9`)">
                        <p class="style-statistic">
                            {{ loading ? '-' : totalTickets }}
                        </p>
                        <p class="style-description-small">
                            {{ loading ? '-' : totalScannedTickets + ' gescand' }}
                        </p>
                    </STInputBox>
                </template>

                <template v-if="hasVouchers">
                    <STInputBox :title="$t(`c2ee9504-b07a-4d79-bd25-c14a1bba4d59`)">
                        <p class="style-statistic">
                            {{ loading ? '-' : totalVouchers }}
                        </p>
                        <p class="style-description-small">
                            {{ loading ? '-' : totalScannedVouchers + ' gescand' }}
                        </p>
                    </STInputBox>
                </template>
            </div>

            <div v-for="category of totalByCategory" :key="category.name" class="container">
                <hr><h2>{{ totalByCategory.length > 1 ? category.name : 'Per productcombinatie' }}</h2>

                <STList>
                    <STListItem v-for="(info, index) in category.products" :key="index" class="right-small">
                        <h3>{{ info.name }}</h3>
                        <p v-if="info.description" class="style-description-small pre-wrap" v-text="info.description" />

                        <template #right>
                            <p class="style-price-big">
                                {{ loading ? '-' : info.amount }}
                            </p>
                            <p class="style-description-small">
                                {{ loading ? '-' : formatPrice(info.price) }}
                            </p>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <hr><h2>{{ $t('33adbc14-dd1a-43a7-a015-98a3322b58c5') }}</h2>
            <p>{{ $t('16d29c4e-f292-4a77-a995-c4fa9ae76200') }}</p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { DateOption, GraphView, STInputBox, STList, STListItem, STNavigationBar, Toast, useContext } from '@stamhoofd/components';
import { GraphViewConfiguration } from '@stamhoofd/components/src/views/GraphViewConfiguration';
import { AppManager } from '@stamhoofd/networking';
import { Category, Graph, GraphData, Order, OrderStatus, ProductType, TicketPrivate, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { DurationLike } from 'luxon';
import { computed, onBeforeUnmount, onMounted, Ref, ref } from 'vue';
import { WebshopManager } from '../WebshopManager';

const props = defineProps<{ webshopManager: WebshopManager }>();

const context = useContext();

const preview = computed(() => props.webshopManager.preview);
const webshop = computed(() => props.webshopManager.webshop);
const hasTickets = computed(() => preview.value.meta.ticketType !== WebshopTicketType.None);
const hasVouchers = computed(() => preview.value.meta.ticketType === WebshopTicketType.Tickets);

async function createGroupedChart(range: DateOption, dataGenerator: (callback: (total: number, date: Date) => void) => Promise<void>): Promise<Graph> {
    // Create range copy so we don't change the reference
    range = new DateOption(range.name, { ...range.range });

    // Keep a Set of all order Id's to prevent duplicate orders (in case an order gets updated, we'll receive it multiple times)
    const orderByDate = new Map<string, { total: number; date: Date }>();

    // todo: determine grouping method
    let groupingMethod: (date: Date) => string = Formatter.dateIso.bind(Formatter);
    let groupingInterval: DurationLike = { days: 1 };
    let groupingLabel = Formatter.date.bind(Formatter);

    // If range is larger than 2 month: group by week
    const days = (range.range.end.getTime() - range.range.start.getTime()) / (1000 * 60 * 60 * 24);
    const initialTimezone = range.range.start.getTimezoneOffset();
    const getDaylightSavingSuffix = (date: Date) => {
        if (date.getTimezoneOffset() !== initialTimezone) {
            return "'";
        }
        return '';
    };

    if (days <= 4) {
        let minutes = 60;

        // If range is larger than 2 days: group by hour
        if (days <= 3) {
            minutes = 30;
        }

        if (days <= 1.5) {
            minutes = 15;
        }

        if (days <= 1) {
            minutes = 10;
        }
        // Group per 15 minutes
        groupingMethod = (date: Date) => {
            return Formatter.dateIso(date) + ' ' + date.getHours() + ':' + Math.floor(date.getMinutes() / minutes) + getDaylightSavingSuffix(date);
        };
        groupingInterval = { minutes };
        groupingLabel = (date: Date) => {
            return Formatter.date(date) + ' ' + date.getHours() + ':' + (Math.floor(date.getMinutes() / minutes) * minutes).toString().padStart(2, '0') + getDaylightSavingSuffix(date);
        };
        range.range.start = Formatter.luxon(range.range.start).startOf('hour').toJSDate();
    }

    console.log(range);

    if (days > 60) {
        groupingMethod = (date: Date) => {
            const lux = Formatter.luxon(date);
            return lux.year + '/' + lux.weekNumber;
        };
        groupingLabel = (date: Date) => {
            const lux = Formatter.luxon(date);
            const start = lux.startOf('week');
            return 'Week van ' + Formatter.date(start.toJSDate(), true);
        };
        groupingInterval = { days: 7 };

        // Modify range.range.start to be a monday
        range.range.start = Formatter.luxon(range.range.start).startOf('week').startOf('day').toJSDate();
    }

    if (days > 366) {
        groupingMethod = (date: Date) => {
            const lux = Formatter.luxon(date);
            return lux.year + '-' + lux.month;
        };
        groupingLabel = (date: Date) => {
            const lux = Formatter.luxon(date);
            return Formatter.capitalizeFirstLetter(Formatter.month(lux.month)) + ' ' + lux.year;
        };
        groupingInterval = { months: 1 };
        range.range.start = Formatter.luxon(range.range.start).startOf('month').startOf('day').toJSDate();
    }

    await dataGenerator((total: number, date: Date) => {
        const group = groupingMethod(date);
        const existing = orderByDate.get(group);
        if (existing) {
            existing.total += total;
        }
        else {
            orderByDate.set(group, {
                total,
                date,
            });
        }
    });

    // Sort by date

    // Now add missing dates to data
    let startDate = Formatter.luxon(range.range.start); // Formatter.luxon(new Date(Math.min(range.range.start.getTime(), data[0]?.date.getTime())))
    const endDate = Formatter.luxon(range.range.end); // Formatter.luxon(new Date(Math.max(range.range.end.getTime(), data[data.length-1]?.date.getTime())))

    while (startDate.toJSDate() < endDate.toJSDate()) {
        startDate = startDate.plus(groupingInterval);
        const jsDate = startDate.toJSDate();

        if (!orderByDate.has(groupingMethod(jsDate))) {
            orderByDate.set(groupingMethod(jsDate), {
                total: 0,
                date: jsDate,
            });
        }
    }

    const data: { total: number; date: Date }[] = [...orderByDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    return Graph.create({
        labels: data.map(d => groupingLabel(d.date)),
        data: [
            GraphData.create({
                label: 'Omzet',
                values: data.map(d => d.total),
            }),
        ],
    });
}

async function loadOrderGraph(range: DateOption, type: 'revenue' | 'count'): Promise<Graph> {
    console.log('Loading ' + type + ' graph');
    const orderIds = new Set<string>();

    return await createGroupedChart(range, async (callback) => {
        await props.webshopManager.orders.stream({
            callback: (order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                // Check in range
                    if (order.createdAt < range.range.start || order.createdAt > range.range.end) {
                        return;
                    }

                    orderIds.add(order.id);

                    switch (type) {
                        case 'revenue':
                            callback(order.data.totalPrice, order.createdAt);
                            break;
                        case 'count':
                            callback(1, order.createdAt);
                            break;
                    }
                }
            } });
    });
}

async function loadScanGraph(range: DateOption, filterVouchers: boolean): Promise<Graph> {
    return await createGroupedChart(range, async (callback) => {
        const orderIds = new Set<string>();

        // Keep track of all the order item ids that are a voucher, so we can count them separately
        const voucherItemMap = new Set<string>();

        await props.webshopManager.orders.stream({
            callback: (order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                    orderIds.add(order.id);

                    // Vouchermap
                    for (const item of order.data.cart.items) {
                        if (item.product.type === ProductType.Voucher) {
                            voucherItemMap.add(item.id);
                        }
                    }
                }
            } });

        await props.webshopManager.tickets.streamAll((ticket: TicketPrivate) => {
            if (ticket.scannedAt && orderIds.has(ticket.orderId)) {
                if (filterVouchers) {
                    if (!ticket.itemId) {
                        return;
                    }
                    if (!voucherItemMap.has(ticket.itemId)) {
                        return;
                    }
                }
                else {
                    if (ticket.itemId && voucherItemMap.has(ticket.itemId)) {
                        return;
                    }
                }

                // Only count tickets for not canceled orders
                return callback(1, ticket.scannedAt);
            }
        }, false);
    });
}

const revenueGraph: Ref<GraphViewConfiguration> = ref(new GraphViewConfiguration({
    title: 'Omzet',
    load: range => loadOrderGraph(range, 'revenue'),
    formatter: (value: number) => Formatter.price(value),
    sum: true,
}));

const countGraph: Ref<GraphViewConfiguration> = ref(new GraphViewConfiguration({
    title: 'Aantal bestellingen',
    load: range => loadOrderGraph(range, 'count'),
    formatter: (value: number) => value.toString(),
    sum: true,
}));

const graphConfigurations: Ref<GraphViewConfiguration[][]> = ref([
    [
        revenueGraph.value,
        countGraph.value,
    ],
]);

function buildTicketDateRangeOptions() {
    const options: DateOption[] = [];
    // Fill options here
    if (firstScannedTicketDate.value && lastScannedTicketDate.value) {
        options.push(new DateOption('Altijd', {
            start: Formatter.luxon(firstScannedTicketDate.value).startOf('minute').toJSDate(),
            end: Formatter.luxon(lastScannedTicketDate.value).endOf('minute').toJSDate(),
        }));
    }
    return options;
}

function buildDateRangeOptions() {
    const options: DateOption[] = [];
    const reference = new Date();
    reference.setHours(23, 59, 59, 999);

    // Fill options here
    if (firstOrderDate.value && lastOrderDate.value) {
        options.push(new DateOption('Altijd', {
            start: Formatter.luxon(firstOrderDate.value).startOf('day').toJSDate(),
            end: Formatter.luxon(lastOrderDate.value).endOf('day').toJSDate(),
        }));
    }

    // Fill options here
    const year = new Date(reference);
    year.setFullYear(reference.getFullYear() - 1);
    options.push(new DateOption('Afgelopen jaar', { start: year, end: reference }));

    // Fill options here
    const months3 = new Date(reference);
    months3.setMonth(reference.getMonth() - 3);
    options.push(new DateOption('Afgelopen 3 maanden', { start: months3, end: reference }));

    // Fill options here
    const months6 = new Date(reference);
    months6.setMonth(reference.getMonth() - 6);
    options.push(new DateOption('Afgelopen 6 maanden', { start: months6, end: reference }));

    // Fill options here
    const month = new Date(reference);
    month.setMonth(reference.getMonth() - 1);
    options.push(new DateOption('Afgelopen maand', { start: month, end: reference }));

    return options;
}

const loading = ref(false);

function formatPrice(price: number) {
    return Formatter.price(price);
}

const totalRevenue = ref(0);
const totalOrders = ref(0);
const averagePrice = ref(0);
const totalTickets = ref(0);
const totalScannedTickets = ref(0);
const firstOrderDate: Ref<Date | null> = ref(null);
const lastOrderDate: Ref<Date | null> = ref(null);
const firstScannedTicketDate: Ref<Date | null> = ref(null);
const lastScannedTicketDate: Ref<Date | null> = ref(null);

const totalVouchers = ref(0);
const totalScannedVouchers = ref(0);

const totalByProduct: Ref<{ amount: number; name: string; description: string; price: number; category: Category | null }[]> = ref([]);

let reviewTimer: NodeJS.Timeout | null = null;

onMounted(() => {
    reload().catch(console.error);
});

const totalByCategory = computed(() => {
    const categories = webshop.value?.categories.map((category) => {
        return {
            id: category.id,
            name: category.name,
            products: [] as { amount: number; name: string; description: string; price: number; category: Category | null }[],
        };
    }) ?? [];

    const other = {
        id: 'other',
        name: 'Overige',
        products: [] as { amount: number; name: string; description: string; price: number; category: Category | null }[],
    };

    for (const product of totalByProduct.value) {
        const category = product.category ? categories.find(c => c.id === product.category!.id) : null;

        if (!category) {
            other.products.push(product);
            continue;
        }

        category.products.push(product);
    }

    categories.push(other);

    return categories.filter(c => c.products.length > 0);
});

async function reload() {
    loading.value = true;
    try {
        totalByProduct.value = [];
        totalRevenue.value = 0;
        totalOrders.value = 0;
        averagePrice.value = 0;
        totalTickets.value = 0;
        totalScannedTickets.value = 0;
        totalVouchers.value = 0;
        totalScannedVouchers.value = 0;
        firstOrderDate.value = null;
        lastOrderDate.value = null;
        firstScannedTicketDate.value = null;
        lastScannedTicketDate.value = null;

        const productMap: Map<string, { amount: number; name: string; description: string; price: number; category: Category | null }> = new Map();

        // Keep a Set of all order Id's to prevent duplicate orders (in case an order gets updated, we'll receive it multiple times)
        const orderIds = new Set<string>();

        // Keep a set of ticket ids to prevent duplicate tickets
        const ticketIds = new Set<string>();

        await props.webshopManager.loadWebshopIfNeeded(false);

        // Keep track of all the order item ids that are a voucher, so we can count them separately
        const voucherItemMap = new Set<string>();

        await props.webshopManager.orders.fetchAllUpdated();
        await props.webshopManager.orders.stream({
            callback: (order: Order) => {
                if (order.status !== OrderStatus.Canceled && order.status !== OrderStatus.Deleted && !orderIds.has(order.id)) {
                    orderIds.add(order.id);
                    totalRevenue.value += order.data.totalPrice;
                    totalOrders.value += 1;

                    if (firstOrderDate.value === null || order.createdAt < firstOrderDate.value) {
                        firstOrderDate.value = order.createdAt;
                    }

                    if (lastOrderDate.value === null || order.createdAt > lastOrderDate.value) {
                        lastOrderDate.value = order.createdAt;
                    }

                    for (const item of order.data.cart.items) {
                        const code = item.codeWithoutFields;
                        const current = productMap.get(code);
                        if (current) {
                            current.amount += item.amount;
                            current.price += item.getPriceWithDiscounts();
                        }
                        else {
                            const productCategory = webshop.value?.categories.find(c => c.productIds.includes(item.product.id));

                            productMap.set(code, {
                                amount: item.amount,
                                name: item.product.name,
                                description: item.descriptionWithoutFields,
                                price: item.getPriceWithDiscounts(),
                                category: productCategory ?? null,
                            });
                        }

                        if (item.product.type === ProductType.Voucher) {
                            voucherItemMap.add(item.id);
                        }
                    }
                }
            } });

        if (props.webshopManager.preview.meta.ticketType !== WebshopTicketType.None) {
            await props.webshopManager.tickets.streamAll((ticket: TicketPrivate) => {
                if (!orderIds.has(ticket.orderId)) {
                    return;
                }
                if (ticketIds.has(ticket.id)) {
                    // Duplicate (e.g. network fetch + local storage)
                    return;
                }
                ticketIds.add(ticket.id);

                if (ticket.scannedAt) {
                    if (!firstScannedTicketDate.value || ticket.scannedAt < firstScannedTicketDate.value) {
                        firstScannedTicketDate.value = ticket.scannedAt;
                    }
                    if (!lastScannedTicketDate.value || ticket.scannedAt > lastScannedTicketDate.value) {
                        lastScannedTicketDate.value = ticket.scannedAt;
                    }
                }

                if (ticket.itemId !== null && voucherItemMap.has(ticket.itemId)) {
                    totalScannedVouchers.value += (ticket.scannedAt ? 1 : 0);
                    totalVouchers.value += 1;
                }
                else {
                    totalScannedTickets.value += (ticket.scannedAt ? 1 : 0);
                    totalTickets.value += 1;
                }
            });
        }

        // Sort productmap values by amount and store in totalByProduct
        totalByProduct.value = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount);

        if (totalOrders.value > 0) {
            averagePrice.value = Math.round(totalRevenue.value / totalOrders.value);
        }

        // create seperate date range options for reactivity
        revenueGraph.value.setOptions(buildDateRangeOptions());
        countGraph.value.setOptions(buildDateRangeOptions());

        if (totalScannedTickets.value > 0 || totalScannedVouchers.value > 0) {
            const group: GraphViewConfiguration[] = [];
            if (totalScannedTickets.value > 0) {
                group.push(new GraphViewConfiguration({
                    title: 'Gescande tickets',
                    options: buildTicketDateRangeOptions(),
                    formatter: (value: number) => value.toString(),
                    sum: true,
                    load: range => loadScanGraph(range, false),
                }));
            }

            if (totalScannedVouchers.value > 0) {
                group.push(new GraphViewConfiguration({
                    title: 'Gescande vouchers',
                    options: buildTicketDateRangeOptions(),
                    formatter: (value: number) => value.toString(),
                    sum: true,
                    load: range => loadScanGraph(range, true),
                }));
            }
            graphConfigurations.value.push(group);
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loading.value = false;

    reviewTimer = setTimeout(() => {
        if (!loading.value && (totalOrders.value > 10 || totalRevenue.value > 50000)) {
            AppManager.shared.markReviewMoment(context.value);
        }
    }, 5 * 1000);
}

onBeforeUnmount(() => {
    if (reviewTimer) {
        clearTimeout(reviewTimer);
    }
});
</script>

<style lang="scss">
.webshop-statistics-view {
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr) );
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
