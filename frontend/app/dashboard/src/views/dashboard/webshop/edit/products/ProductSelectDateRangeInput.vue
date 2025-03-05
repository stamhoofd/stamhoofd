<template>
    <div>
        <STList v-if="dateRanges.length > 0">
            <STListItem v-for="_dateRange in dateRanges" :key="_dateRange.id" element-name="label" :selectable="true" class="left-center dateRange-selection">
                <template #left>
                    <Radio v-model="selectedDateRange" :value="_dateRange" @change="changeSelected"/>
                </template>
                <h3>
                    {{ formatDate(_dateRange) }}
                </h3>
                <template #right>
                    <button type="button" class="button icon gray edit" @click.stop="doEditDateRange(_dateRange)"/>
                </template>
            </STListItem>
            <STListItem element-name="label" :selectable="true" class="left-center">
                <template #left>
                    <Radio v-model="selectedDateRange" :value="null" @change="changeSelected"/>
                </template>
                {{ $t('ae8de534-f96c-40d2-84b8-f8a438c31b5e') }}
            </STListItem>
        </STList>
        <p v-if="editingDateRange" class="warning-box">
            {{ $t("53cf0d0b-7f16-47cd-b050-9834d903bc9a") }}
        </p>
        <ProductDateRangeInput v-if="editingDateRange || selectedDateRange === null" v-model="editDateRange" :validator="internalValidator"/>
        <STErrorsDefault :error-box="errors.errorBox"/>
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, Radio, STErrorsDefault, STList, STListItem, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed, onMounted, ref, watch } from 'vue';
import ProductDateRangeInput from './ProductDateRangeInput.vue';

const props = withDefaults(defineProps<{ title?: string; dateRanges: ProductDateRange[];
    // Assign a validator if you want to offload the validation to components
    validator?: Validator | null; }>(), {
    title: '',
    validator: null,
});

const emits = defineEmits<{ (e: 'modify', value: { from: ProductDateRange; to: ProductDateRange }): void }>();

const model = defineModel<ProductDateRange | null>({ default: null });
const errors = useErrors({ validator: props.validator });
const internalValidator = new Validator();

const selectedDateRange = ref<ProductDateRange | null>(null);
const customDateRange = ref<ProductDateRange | null>(null);
const editingDateRange = ref(false);

watch(model, (val: ProductDateRange | null) => {
    if (val === (selectedDateRange.value ?? customDateRange.value ?? null)) {
        // Not changed
        return;
    }

    if (!val) {
        return;
    }

    const a = props.dateRanges.find(aa => aa.id === val.id);
    if (a) {
        selectedDateRange.value = a;
        if (editingDateRange.value) {
            customDateRange.value = a;
        }
        else {
            customDateRange.value = null;
        }
    }
    else {
        selectedDateRange.value = null;
        editingDateRange.value = false;
        customDateRange.value = val;
    }
});

onMounted(() => {
    const a = props.dateRanges.find(aa => aa.id === model.value?.id);
    if (a) {
        selectedDateRange.value = a;
        editingDateRange.value = false;
        customDateRange.value = null;
    }
    else {
        selectedDateRange.value = null;
        editingDateRange.value = false;
        customDateRange.value = model.value;

        if (!model.value) {
            if (props.dateRanges.length > 0) {
                model.value = props.dateRanges[0];
            }
            else {
                model.value = ProductDateRange.create({
                    startDate: new Date(),
                    endDate: new Date(),
                });
            }
        }
    }
});

useValidation(errors.validator, () => {
    return isValid();
});

function formatDate(range: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(range.toString());
}

function changeSelected() {
    console.log('ChangeSelected');
    if (editingDateRange.value) {
        customDateRange.value = null;
    }
    editingDateRange.value = false;

    let a = selectedDateRange.value ?? customDateRange.value;
    if (!a) {
        // Create a new custom one
        a = customDateRange.value = ProductDateRange.create({
            startDate: props.dateRanges[props.dateRanges.length - 1]?.startDate ?? new Date(),
            endDate: props.dateRanges[props.dateRanges.length - 1]?.endDate ?? new Date(),
        });
    }
    if (a) {
        model.value = a;
    }
}

function doEditDateRange(dateRange: ProductDateRange) {
    model.value = dateRange;
    editingDateRange.value = true;
    selectedDateRange.value = dateRange;
    customDateRange.value = dateRange;
}

const editDateRange = computed({
    get: () => customDateRange.value,
    set: (dateRange: ProductDateRange | null) => {
        if (editingDateRange.value && selectedDateRange.value && dateRange) {
            emits('modify', { from: selectedDateRange.value, to: dateRange });
            selectedDateRange.value = dateRange;
            model.value = dateRange;
            editingDateRange.value = true;
        }
        else {
            model.value = dateRange;
        }
        customDateRange.value = dateRange;
    },
});

async function isValid(): Promise<boolean> {
    const isValid = await internalValidator.validate();
    if (!isValid) {
        errors.errorBox = null;
        return false;
    }

    if (selectedDateRange.value) {
        model.value = selectedDateRange.value;
        errors.errorBox = null;
        return true;
    }

    if (!customDateRange.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'Kies een datum',
            field: 'dateRange',
        }));
        return false;
    }

    errors.errorBox = null;
    model.value = customDateRange.value;
    return true;
}
</script>
