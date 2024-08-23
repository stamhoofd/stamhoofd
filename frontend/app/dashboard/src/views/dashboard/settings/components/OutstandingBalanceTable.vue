<template>
    <div class="container">
        <hr>
        <h2>Openstaand</h2>

        <p v-if="groupedItems.length === 0" class="info-box">
            Je hebt geen openstaande schulden
        </p>
        <template v-else>
            <STList>
                <STListItem v-for="group in groupedItems" :key="group.id" :selectable="true">
                    <template #left>
                        <span class="style-amount min-width">{{ formatFloat(group.amount) }}</span>
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
                        <p class="style-description-small">
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
import { chooseOrganizationMembersForGroup, PriceBreakdownBox, useContext, useNavigationActions, useOrganizationCart } from "@stamhoofd/components";
import { useRequestOwner } from "@stamhoofd/networking";
import { BalanceItemCartItem, BalanceItemWithPayments, OrganizationDetailedBillingStatusItem, RegisterCheckout } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    item: OrganizationDetailedBillingStatusItem
}>();

const items = computed(() => props.item.balanceItems)
const context = useContext();
const owner = useRequestOwner();
const navigate = useNavigationActions()
const openCart = useOrganizationCart()

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
        return this.items[0]
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
        return this.items.reduce((acc, item) => acc + item.openPrice, 0);
    }

    get prefix() {
        return this.items[0].groupPrefix;
    }

    get title() {
        return this.items[0].groupTitle;
    }

    get description() {
        return this.items[0].groupDescription;
    }

    get unitPrice() {
        return this.items[0].unitPrice;
    }
}

const filteredItems = computed(() => {
    return items.value//.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).totalOpen !== 0);
})

const groupedItems = computed(() => {
    const map = new Map<string, GroupedItems>();

    for (const item of filteredItems.value) {
        const code = item.groupCode;
        if (!map.has(code)) {
            map.set(code, new GroupedItems());
        }

        map.get(code)!.add(item);
    }

    return Array.from(map.values()).filter(v => v.price > 0);
})

const priceBreakdown = computed(() => {
    const c = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value);

    return [
        { name: 'Totaal', price: c.totalOpen },
    ]
})

async function checkout() {
    const checkout = new RegisterCheckout();
    
    for (const g of filteredItems.value) {
        const open = g.openPrice;

        if (open !== 0) {
            checkout.addBalanceItem(BalanceItemCartItem.create({
                item: g,
                price: open
            }))
        }
    }

    await openCart({
        organization: props.item.organization,
        checkout
    })
}

</script>
