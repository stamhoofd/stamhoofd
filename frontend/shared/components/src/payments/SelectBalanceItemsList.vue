<template>
    <STList>
        <STListItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true" class="right-stack no-margin">
            <template #left>
                <Checkbox :model-value="isItemSelected(item)" :disabled="isPayable && item.priceOpen < 0" @update:model-value="setItemSelected(item, $event)" />
            </template>

            <p v-if="item.dueAt" class="style-title-prefix-list" :class="{error: item.isOverDue}">
                <span>Te betalen tegen {{ formatDate(item.dueAt) }}</span>
                <span v-if="item.isOverDue" class="icon error small" />
            </p>
            <p v-if="item.status === BalanceItemStatus.Canceled && item.priceOpen < 0" class="style-title-prefix-list error">
                <span>Tegoed wegens annulatie</span>
                <span class="icon disabled small" />
            </p>
            <p v-else-if="item.priceOpen < 0" class="style-title-prefix-list">
                <span v-if="!isPayable">Terug te betalen</span>
                <span v-else>Tegoed</span>
                <span class="icon undo small" />
            </p>

            <h3 class="style-title-list">
                {{ item.itemTitle }}
            </h3>
            <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />
            <p class="style-description-small">
                {{ formatDate(item.createdAt) }}
            </p>

            <template #right>
                <div v-if="isItemSelected(item)">
                    <p v-if="isPayable && getItemPrice(item) < 0" class="style-price-base">
                        {{ formatPrice(getItemPrice(item)) }}
                    </p>
                    <PriceInput v-else :model-value="getItemPrice(item)" placeholder="0 euro" :min="item.priceOpen < 0 ? item.priceOpen : 0" :max="item.priceOpen >= 0 ? item.priceOpen : 0" @update:model-value="setItemPrice(item, $event)" />
                </div>
                <template v-else>
                    <p class="style-discount-old-price disabled">
                        ({{ formatPrice(item.priceOpen) }})
                    </p>
                </template>
            </template>
        </STListItem>
    </STList>

    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PriceBreakdownBox, PriceInput } from '@stamhoofd/components';
import { BalanceItem, BalanceItemPaymentDetailed, BalanceItemStatus } from '@stamhoofd/structures';
import { computed, nextTick, onMounted } from 'vue';

const props = defineProps<{
    items: BalanceItem[];
    list: BalanceItemPaymentDetailed[];
    isPayable: boolean;
}>();

onMounted(async () => {
    if (props.list.length === 0) {
        // Default select
        for (const item of props.items) {
            if (item.isDue) {
                setItemSelected(item, true);
            }
        }

        await nextTick();

        if (total.value <= 0) {
            // Try to select due items
            for (const item of props.items) {
                if (!item.isDue) {
                    setItemSelected(item, true);
                    await nextTick();

                    if (total.value > 0) {
                        break;
                    }
                }
            }
        }
    }
});

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
            price: item.priceOpen,
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
