<template>
    <STList>
        <STListItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true">
            <template #left>
                <Checkbox :model-value="isItemSelected(item)" :disabled="isPayable && item.priceOpen < 0" @update:model-value="setItemSelected(item, $event)" />
            </template>

            <BalanceItemTitleBox :item="item" :is-payable="isPayable" :show-prices="false" />

            <div v-if="isItemSelected(item) && isCustomizeItemValue(item)" class="split-inputs option" @click.stop>
                <div>
                    <STInputBox :title="item.priceOpen >= 0 ? $t('aeed7048-efaa-410d-bec1-796b5fe581a6') : $t('1d864313-d956-41b6-b95b-77227297fb0e')">
                        <PriceInput :currency="getItemPrice(item) === item.priceOpen ? 'euro' : ('/ ' + formatFloat(Math.abs(item.priceOpen) / 100_00) + ' euro')" :model-value="Math.abs(getItemPrice(item))" :min="0" :max="Math.abs(item.priceOpen)" :placeholder="$t(`240b3e60-bab9-47d6-bcfb-71e138d2cd2c`)" @update:model-value="setItemPrice(item, Math.abs($event) * Math.sign(item.priceOpen))" />
                    </STInputBox>
                </div>
            </div>
            <p v-else class="style-description">
                <span v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                    ({{ formatPrice(item.priceOpen) }})
                </span>
                <span v-else class="style-price-base" :class="{negative: item.priceOpen < 0}">
                    {{ formatPrice(item.priceOpen) }}
                </span>
            </p>

            <template v-if="canCustomizeItemValue(item)" #right>
                <button v-if="isItemSelected(item) && (!isPayable || item.priceOpen > 0)" v-tooltip="$t('0acc0348-ae29-444b-a93f-5d513247eff6')" :class="{'no-partially': isCustomizeItemValue(item), 'partially': !isCustomizeItemValue(item)}" type="button" class="button icon" @click="toggleCustomizeItemValue(item)" />
            </template>
        </STListItem>
    </STList>

    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PriceBreakdownBox, PriceInput, STInputBox } from '@stamhoofd/components';
import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { computed, nextTick, onMounted, ref } from 'vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(defineProps<{
    items: BalanceItem[];
    list: BalanceItemPaymentDetailed[];
    isPayable: boolean;
    canCustomizeItemValue?: (item: BalanceItem) => boolean;
}>(), {
    canCustomizeItemValue: () => true,
});

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
    return BalanceItem.filterBalanceItems(props.items);
});

const total = computed(() => {
    return props.list.reduce((total, item) => total + item.price, 0);
});

const priceBreakdown = computed(() => {
    return [
        {
            name: $t(`341172ee-281e-4458-aeb1-64ed5b2cc8bb`),
            price: total.value,
        },
    ];
});

function toggleCustomizeItemValue(item: BalanceItem) {
    if (customizeItemValues.value.has(item.id)) {
        customizeItemValues.value.delete(item.id);
        setItemPrice(item, item.priceOpen);
    }
    else {
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
