<template>
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

                <p v-if="group.amount !== 1" class="style-description-small">
                    {{ formatPrice(group.unitPrice) }}
                </p>
                
                <template #right>
                    <p class="style-description-small">
                        {{ formatPrice(group.price) }}
                    </p>
                </template>
            </STListItem>
        </STList>

        <PriceBreakdownBox :price-breakdown="priceBreakdown" />
    </template>
</template>

<script setup lang="ts">
import { PriceBreakdownBox } from "@stamhoofd/components";
import { BalanceItemWithPayments } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    items: BalanceItemWithPayments[]
}>();

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

    get amount() {
        return this.items.reduce((acc, item) => acc + item.amount, 0);
    }

    get price() {
        return this.items.reduce((acc, item) => acc + item.price, 0);
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
    return props.items.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).totalOpen !== 0);
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

    return Array.from(map.values());
})

const priceBreakdown = computed(() => {
    const c = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value);

    return [
        { name: c.total >= 0 ? 'Totaal te betalen' : 'Totaal terug te krijgen', price: c.total },
        { name: 'Waarvan in verwerking', price: c.totalPending },
        { name: 'Totaal', price: c.totalOpen },
    ]
})

</script>
