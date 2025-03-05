<template>
    <div class="product-location-input">
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`64e33410-9d9e-4a76-844c-be42b94e134b`)">
            <input v-model="name" class="input" :placeholder="$t(`bf6480b4-c52b-448f-84ec-a7c388c0f871`)"></STInputBox>
        <AddressInput v-model="address" :validator="validator" :required="false" :title="$t(`09698467-c3c4-4e2e-876d-4697f91499fd`)"/>
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
