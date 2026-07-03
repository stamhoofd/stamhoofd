<template>
    <STList>
        <STListItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true">
            <template #left>
                <Checkbox :model-value="isItemSelected(item)" :disabled="isPayable && item.priceOpen < 0" @update:model-value="setItemSelected(item, $event)" />
            </template>

            <BalanceItemTitleBox :item="item" :is-payable="isPayable" :show-prices="false" />

            <div v-if="isItemSelected(item) && isCustomizeItemValue(item)" class="split-inputs option" @click.stop>
                <div>
                    <STInputBox :title="fullPrice(item) >= 0 ? $t('%16x') : $t('%16y')">
                        <PriceInput :currency="getItemPrice(item) === fullPrice(item) ? 'euro' : ('/ ' + formatFloat(Math.abs(fullPrice(item)) / 100_00) + ' euro')" :model-value="Math.abs(getItemPrice(item))" :min="0" :max="Math.abs(fullPrice(item))" :placeholder="$t(`%2X`)" @update:model-value="setItemPrice(item, Math.abs($event) * Math.sign(fullPrice(item)))" />
                    </STInputBox>
                </div>
            </div>
            <p v-else class="style-description">
                <span v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                    ({{ formatPrice(getDisplayPrice(item)) }})
                </span>
                <span v-else class="style-price-base" :class="{negative: getDisplayPrice(item) < 0}">
                    {{ formatPrice(getDisplayPrice(item)) }}
                </span>
            </p>

            <template v-if="canCustomizeItemValue(item)" #right>
                <button v-if="isItemSelected(item) && (!isPayable || item.priceOpen > 0)" v-tooltip="$t('%16z')" :class="{'no-partially': isCustomizeItemValue(item), 'partially': !isCustomizeItemValue(item)}" type="button" class="button icon" @click="toggleCustomizeItemValue(item)" />
            </template>
        </STListItem>
    </STList>

    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import PriceInput from '#inputs/PriceInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { computed, nextTick, onMounted, ref } from 'vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(defineProps<{
    items: BalanceItem[];
    list: BalanceItemPaymentDetailed[];
    isPayable: boolean;
    canCustomizeItemValue?: (item: BalanceItem) => boolean;

    /**
     * The (maximum) price that gets selected for an item. Defaults to the open amount of the item.
     * Used when refunding a specific payment: then the price paid via that payment is used instead.
     */
    getFullPrice?: ((item: BalanceItem) => number) | null;
}>(), {
    canCustomizeItemValue: () => true,
    getFullPrice: null,
});

function fullPrice(item: BalanceItem) {
    return props.getFullPrice ? props.getFullPrice(item) : item.priceOpen;
}

/**
 * The price shown for an item when the price input is not visible:
 * the selected price, or the price that would get selected.
 */
function getDisplayPrice(item: BalanceItem) {
    if (isItemSelected(item)) {
        return getItemPrice(item);
    }
    return fullPrice(item);
}

const customizeItemValues = ref(new Set<string>());

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
    return props.getFullPrice ? props.items : BalanceItem.filterBalanceItems(props.items);
});

const total = computed(() => {
    return props.list.reduce((total, item) => total + item.price, 0);
});

const priceBreakdown = computed(() => {
    return [
        {
            name: $t(`%xL`),
            price: total.value,
        },
    ];
});

function toggleCustomizeItemValue(item: BalanceItem) {
    if (customizeItemValues.value.has(item.id)) {
        customizeItemValues.value.delete(item.id);
        setItemPrice(item, fullPrice(item));
    } else {
        customizeItemValues.value.add(item.id);
    }
}

function isCustomizeItemValue(item: BalanceItem) {
    return customizeItemValues.value.has(item.id);
}

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
            price: fullPrice(item),
        });
        const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray();
        arr.addPut(add);
        addPatch(arr);
    } else {
        const q = props.list.find(p => p.balanceItem.id === item.id);
        const id = q?.id;

        if (id) {
            const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray();
            arr.addDelete(id);
            addPatch(arr);
        } else {
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
