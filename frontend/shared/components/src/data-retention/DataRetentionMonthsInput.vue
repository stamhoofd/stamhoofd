<template>
    <div class="input-group">
        <NumberInput v-model="amount" :min="1" :disabled="disabled" />
        <Dropdown v-model="unit" :disabled="disabled">
            <option value="months">
                {{ $t('maanden') }}
            </option>
            <option value="years">
                {{ $t('jaar') }}
            </option>
        </Dropdown>
    </div>
</template>

<script lang="ts" setup>
import Dropdown from '#inputs/Dropdown.vue';
import NumberInput from '#inputs/NumberInput.vue';
import { computed, ref } from 'vue';

withDefaults(defineProps<{
    disabled?: boolean;
}>(), {
    disabled: false,
});

/**
 * A term is always stored in months. Whole years are shown in years.
 */
const months = defineModel<number | null>({ required: true });
const selectedUnit = ref<'months' | 'years'>(months.value !== null && months.value % 12 === 0 ? 'years' : 'months');

const amount = computed({
    get: () => {
        if (months.value === null) {
            return null;
        }
        return selectedUnit.value === 'years' ? months.value / 12 : months.value;
    },
    set: (value: number | null) => {
        months.value = value === null ? null : value * (selectedUnit.value === 'years' ? 12 : 1);
    },
});

// Changing the unit keeps the number: 2 months becomes 2 years
const unit = computed({
    get: () => selectedUnit.value,
    set: (value: 'months' | 'years') => {
        const current = amount.value;
        selectedUnit.value = value;
        amount.value = current;
    },
});
</script>
