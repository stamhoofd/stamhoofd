<template>
    <STList>
        <STListItem v-for="group in groupedItems" :key="group.id">
            <template #left>
                <span class="style-amount min-width">
                    <figure class="style-image-with-icon gray">
                        <figure>
                            <span class="icon" :class="getBalanceItemTypeIcon(group.balanceItem.type)" />
                        </figure>
                        <aside>
                            <span v-if="group.amount > 1" class="style-bubble primary">
                                {{ group.amount }}
                            </span>
                        </aside>
                    </figure>
                </span>
            </template>

            <p v-if="group.dueAt" class="style-title-prefix-list" :class="{error: group.dueAt && group.dueAt <= now}">
                <span>Te betalen tegen {{ formatDate(group.dueAt) }}</span>
                <span v-if="group.dueAt && group.dueAt <= now" class="icon error small" />
            </p>
            <p v-if="group.status === BalanceItemStatus.Canceled" class="style-title-prefix-list error">
                <span>Geannuleerd</span>
                <span class="icon disabled small" />
            </p>
            <p v-else-if="group.price < 0" class="style-title-prefix-list">
                <span v-if="isPayable">Terug te krijgen</span>
                <span v-else>Terug te betalen</span>
                <span class="icon undo small" />
            </p>

            <h3 class="style-title-list">
                {{ group.title }}
            </h3>

            <p v-if="group.description" class="style-description-small pre-wrap" v-text="group.description" />

            <p class="style-description-small">
                {{ formatFloat(group.amount) }} x {{ formatPrice(group.unitPrice) }}
            </p>

            <p v-if="group.pricePaid !== 0" class="style-description-small">
                {{ formatPrice(group.pricePaid) }} betaald
            </p>

            <template #right>
                <p v-if="!group.isDue" v-tooltip="group.dueAt ? ('Te betalen tegen ' + formatDate(group.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                    ({{ formatPrice(group.price) }})
                </p>
                <p v-else class="style-price-base">
                    {{ formatPrice(group.price) }}
                </p>
            </template>
        </STListItem>
    </STList>
</template>

<script setup lang="ts">
import { BalanceItemWithPayments, DetailedPayableBalance, DetailedReceivableBalance, getBalanceItemTypeIcon, BalanceItemStatus } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useNow } from '../hooks';

const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();
const isPayable = props.item instanceof DetailedPayableBalance;

const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;
const now = useNow();

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
        return this.items.reduce((acc, item) => acc + item.amount, 0);
    }

    get status() {
        return this.balanceItem.status;
    }

    /**
     * Only shows outstanding price
     */
    get price() {
        return this.items.reduce((acc, item) => acc + item.priceOpen, 0);
    }

    get pricePaid() {
        return this.items.reduce((acc, item) => acc + item.pricePaid, 0);
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

    get dueAt() {
        return this.items[0].dueAt; ;
    }

    get isDue() {
        return this.items[0].isDue;
    }
}

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

</script>
