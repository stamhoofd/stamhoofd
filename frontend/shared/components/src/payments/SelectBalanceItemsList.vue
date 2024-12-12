<template>
    <STList>
        <STListItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true">
            <template #left>
                <Checkbox :model-value="isItemSelected(item)" :indeterminate="getItemPrice(item) !== item.priceOpen" @update:model-value="setItemSelected(item, $event)" />
            </template>

            <p v-if="item.dueAt" class="style-title-prefix-list" :class="{error: item.dueAt && item.dueAt <= new Date()}">
                <span>Te betalen tegen {{ formatDate(item.dueAt) }}</span>
                <span v-if="item.dueAt && item.dueAt <= new Date()" class="icon error small" />
            </p>

            <h3 class="style-title-list">
                {{ item.itemTitle }}
            </h3>
            <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />
            <p class="style-description-small">
                {{ formatDate(item.createdAt) }}
            </p>

            <div v-if="isItemSelected(item)" class="split-inputs option" @click.stop.prevent>
                <STInputBox title="Gedeeltelijk betalen">
                    <PriceInput :model-value="getItemPrice(item)" placeholder="0 euro" :min="item.priceOpen < 0 ? item.priceOpen : 0" :max="item.priceOpen >= 0 ? item.priceOpen : 0" @update:model-value="setItemPrice(item, $event)" />
                </STInputBox>
            </div>

            <template #right>
                <p v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                    ({{ formatPrice(item.priceOpen) }})
                </p>
                <p v-else class="style-price-base">
                    {{ formatPrice(item.priceOpen) }}
                </p>
            </template>
        </STListItem>
    </STList>

    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { computed } from 'vue';
import PriceInput from '../inputs/PriceInput.vue';
import { PriceBreakdownBox } from '@stamhoofd/components';

const props = defineProps<{
    items: BalanceItem[];
    list: BalanceItemPaymentDetailed[];
}>();

const emit = defineEmits<{ (e: 'patch', patch: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed>): void }>();

const filteredBalanceItems = computed(() => {
    return BalanceItem.filterBalanceItems(props.items);
});

const total = computed(() => {
    return props.list.reduce((total, item) => total + item.price, 0);
});

const priceBreakdown = computed(() => {
    return [
        {
            name: 'Totaal',
            price: total.value,
        },
    ];
});

function addPatch(p: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed>) {
    emit('patch', p);
}

function isItemSelected(item: BalanceItem) {
    return props.list.some(i => i.balanceItem.id === item.id);
}

function setItemSelected(item: BalanceItem, selected: boolean) {
    if (isItemSelected(item) === selected) {
        return;
    }

    if (selected) {
        const add = BalanceItemPaymentDetailed.create({
            balanceItem: item,
            price: item.price - item.pricePaid,
        });
        const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray();
        arr.addPut(add);
        addPatch(arr);
    }
    else {
        const q = props.list.find(p => p.balanceItem.id === item.id);
        const id = q?.id;

        if (id) {
            const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray();
            arr.addDelete(id);
            addPatch(arr);
        }
        else {
            console.error('Could not find item to remove', item, q);
        }
    }
}

function getItemPrice(item: BalanceItem) {
    return props.list.find(p => p.balanceItem.id === item.id)?.price ?? 0;
}

function setItemPrice(item: BalanceItem, price: number) {
    setItemSelected(item, true);
    const id = props.list.find(p => p.balanceItem.id === item.id)?.id;

    if (id) {
        const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray();
        arr.addPatch(BalanceItemPaymentDetailed.patch({
            id,
            price,
        }));
        addPatch(arr);
    }
}

</script>
