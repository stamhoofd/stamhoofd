<template>
    <SaveView :title="isNew ? $t(`0569800c-393c-486e-8d97-9c2b7689624a`) : $t(`d0bb4aed-a00e-4725-83d8-b6d1cf8fc90c`)" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('771a87bb-4032-4cd4-967c-a145134f0b0a') }}
        </h1>
        <h1 v-else>
            {{ $t('8e2090b0-e2e4-4553-b41a-2cd1b4e44f61') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <ProductsSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector" />

        <STInputBox error-fields="amount" :error-box="errors.errorBox" class="max" :title="$t(`697df3e7-fbbf-421d-81c2-9c904dce4842`)">
            <NumberInput v-model="amount" :min="1" :stepper="true" />
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('4fc6f5f9-be3e-4e52-84d1-7f68f6a02468') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, NumberInput, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { DiscountRequirement, PrivateWebshop, ProductsSelector } from '@stamhoofd/structures';

import { computed } from 'vue';
import ProductsSelectorBox from './ProductsSelectorBox.vue';

const props = defineProps<{
    discountRequirement: DiscountRequirement;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => void;
}>();
const errors = useErrors();
const pop = usePop();

const { patch: patchDiscountRequirement, patched: patchedDiscountRequirement, addPatch, hasChanges } = usePatch(props.discountRequirement);

const productSelector = computed(() => patchedDiscountRequirement.value.product);

function patchProductSelector(patch: AutoEncoderPatchType<ProductsSelector>) {
    addPatch(DiscountRequirement.patch({
        product: patch,
    }));
}

const amount = computed({
    get: () => patchedDiscountRequirement.value.amount,
    set: (amount: number) => {
        addPatch(DiscountRequirement.patch({
            amount,
        }));
    },
});

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
    p.addPatch(patchDiscountRequirement.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze voorwaarde wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
    p.addDelete(props.discountRequirement.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
