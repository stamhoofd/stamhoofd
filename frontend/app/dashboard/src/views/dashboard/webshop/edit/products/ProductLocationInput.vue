<template>
    <div class="product-location-input">
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`Locatienaam`)">
            <input v-model="name" class="input" :placeholder="$t(`bv. Gemeentelijke feestzaal`)">
        </STInputBox>
        <AddressInput v-model="address" :validator="validator" :required="false" :title="$t(`Adres (optioneel)`)" />
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput, ErrorBox, STInputBox, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { Address, ProductLocation } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    // Assign a validator if you want to offload the validation to components
    validator: Validator | null;
}>();

const errors = useErrors({ validator: props.validator });
const model = defineModel<ProductLocation | null>({ default: null });

useValidation(errors.validator, () => isValid());

const name = computed({
    get: () => model.value?.name ?? '',
    set: (name: string) => {
        if (model.value) {
            model.value = model.value.patch({ name });
        }
    },
});

const address = computed({
    get: () => model.value?.address ?? null,
    set: (address: Address | null) => {
        if (model.value) {
            model.value = model.value.patch({ address });
        }
    },
});

async function isValid(): Promise<boolean> {
    await Promise.resolve();
    if (name.value.length < 2) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'name',
            message: 'Vul een locatienaam in',
        }));
        return false;
    }

    return true;
}
</script>
