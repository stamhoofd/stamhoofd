<template>
    <div v-if="groupedItems.length !== 0 || !showName" class="container">
        <hr>
        <h2>
            Openstaand<template v-if="showName">
                bij {{ item.organization.name }}
            </template>
        </h2>

        <p v-if="groupedItems.length === 0" class="info-box">
            Je hebt geen openstaande schulden
        </p>
        <template v-else>
            <STList>
                <STListItem v-for="group in groupedItems" :key="group.id">
                    <template #left>
                        <span class="style-amount min-width">
                            <figure class="style-image-with-icon gray">
                                <figure>
                                    <span class="icon" :class="getBalanceItemTypeIcon(group.balanceItem.type)" />
                                </figure>
                                <aside>
                                    <span v-if="group.amount <= 0" class="icon disabled small red" />
                                    <span v-if="group.amount > 1" class="style-bubble primary">
                                        {{ group.amount }}
                                    </span>
                                </aside>
                            </figure>
                        </span>
                    </template>

                    <p v-if="group.prefix" class="style-title-prefix-list">
                        {{ group.prefix }}
                    </p>

                    <h3 class="style-title-list">
                        {{ group.title }}
                    </h3>

                    <p v-if="group.description" class="style-description-small">
                        {{ group.description }}
                    </p>

                    <p class="style-description-small">
                        {{ formatFloat(group.amount) }} x {{ formatPrice(group.unitPrice) }}
                    </p>

                    <template #right>
                        <p class="style-price-base">
                            {{ formatPrice(group.price) }}
                        </p>
                    </template>
                </STListItem>
            </STList>

            <PriceBreakdownBox :price-breakdown="priceBreakdown" />

            <p class="style-button-bar right-align">
                <button class="button primary" type="button" @click="checkout">
                    <span>Betalen</span>
                    <span class="icon arrow-right" />
                </button>
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { GlobalEventBus, PriceBreakdownBox, Toast, useAppContext, useOrganizationCart } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { BalanceItemCartItem, BalanceItemWithPayments, DetailedPayableBalance, RegisterCheckout, getBalanceItemTypeIcon } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    item: DetailedPayableBalance;
    showName: boolean;
}>();

const items = computed(() => props.item.balanceItems);
const openCart = useOrganizationCart();
const app = useAppContext();
const memberManager = useMemberManager();
const dismiss = useDismiss();

class GroupedItems {
    items: BalanceItemWithPayments[];

    constructor() {
        this.items = [];
    }

    get id() {
        return this.items[0].groupCode;
    }

    add(item: BalanceItemWithPayments) {
        this.items.push(item);
    }

    get balanceItem() {
        return this.items[0];
    }

    /**
     * Only shows amount open
     */
    get amount() {
        if (this.unitPrice === 0) {
            // Not possible to calculate amount
            return this.balanceItem.amount;
        }

        return this.price / this.unitPrice;
    }

    /**
     * Only shows outstanding price
     */
    get price() {
        return this.items.reduce((acc, item) => acc + item.priceOpen, 0);
    }

    get prefix() {
        if (this.items.length === 1) {
            // Return normal prefix
            return this.items[0].itemPrefix;
        }
        return this.items[0].groupPrefix;
    }

    get title() {
        if (this.items.length === 1) {
            // Return normal prefix
            return this.items[0].itemTitle;
        }
        return this.items[0].groupTitle;
    }

    get description() {
        if (this.items.length === 1) {
            // Return normal prefix
            return this.items[0].itemDescription;
        }
        return this.items[0].groupDescription;
    }

    get unitPrice() {
        return this.items[0].unitPrice;
    }
}

const filteredItems = computed(() => {
    return items.value.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).totalOpen !== 0);
});

const groupedItems = computed(() => {
    const map = new Map<string, GroupedItems>();

    for (const item of filteredItems.value) {
        const code = item.groupCode;
        if (!map.has(code)) {
            map.set(code, new GroupedItems());
        }

        map.get(code)!.add(item);
    }

    return Array.from(map.values()).filter(v => v.price !== 0);
});

const priceBreakdown = computed(() => {
    const c = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value);

    return [
        { name: 'Totaal', price: c.totalOpen },
    ];
});

async function checkout() {
    let checkout = new RegisterCheckout();

    if (app === 'registration') {
        // Use member manager
        checkout = memberManager.family.checkout;
    }

    for (const g of filteredItems.value) {
        const open = g.priceOpen;

        if (open !== 0) {
            checkout.addBalanceItem(BalanceItemCartItem.create({
                item: g,
                price: open,
            }));
        }
    }

    if (app === 'registration') {
        checkout.defaultOrganization = props.item.organization;
        Toast.success('Openstaande rekening toegevoegd aan winkelmandje. Reken je winkelmandje af of voeg eventueel nog andere zaken toe.').setIcon('basket').show();
        await dismiss({ force: true });
        await GlobalEventBus.sendEvent('selectTabByName', 'mandje');
        return;
    }

    await openCart({
        organization: props.item.organization,
        checkout,
    });
}

</script>
