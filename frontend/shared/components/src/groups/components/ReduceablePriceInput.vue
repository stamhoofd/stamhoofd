<template>
    <STErrorsDefault :error-box="ownErrors.errorBox" />
    <div class="split-inputs">
        <STInputBox :title="title" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" :min="min" />
        </STInputBox>

        <STInputBox v-if="enabled || reducedPrice !== null" :title="financialSupportSettings.priceName" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="reducedPrice" :placeholder="formatPrice(price)" :min="min" :required="false" />
        </STInputBox>
    </div>
</template>

<script setup lang="ts">
import { PriceInput, STErrorsDefault, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { Group, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useFinancialSupportSettings } from '../hooks';
import { SimpleError } from '@simonbackx/simple-errors';

const props = withDefaults(
    defineProps<{
        validator: Validator,
        errorBox?: ErrorBox|null,
        min?: number|null,
        group?: Group|null,
        title?: string
    }>(),
    {
        errorBox: null,
        min: null,
        title: 'Prijs',
        group: null
    }
);
const model = defineModel<ReduceablePrice>({ required: true })
const ownErrors = useErrors();
const {enabled, financialSupportSettings} = useFinancialSupportSettings({
    group: computed(() => props.group),
})

useValidation(props.validator, () => {
    if (!enabled.value && model.value.reducedPrice !== null) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reducced_price',
            field: 'price',
            message: 'Financial support is not enabled, but you have set a reduced price',
            human: `De functie ${financialSupportSettings.value.title} staat uit, maar je hebt nog ${financialSupportSettings.value.priceName} ingesteld`
        }))
        return false;
    }
    ownErrors.errorBox = null;
    return true;
})

const price = computed({
    get: () => model.value.price,
    set: (price) => model.value = model.value.patch({ price })
})
const reducedPrice = computed({
    get: () => model.value.reducedPrice,
    set: (reducedPrice) => model.value = model.value.patch({ reducedPrice })
})
</script>
