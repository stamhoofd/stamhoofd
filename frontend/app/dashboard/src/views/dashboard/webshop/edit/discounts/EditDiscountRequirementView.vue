<template>
    <SaveView :title="isNew ? $t(`Kortingvoorwaarde toevoegen`) : $t(`Kortingvoorwaarde bewerken`)" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('e31da09b-7ede-4aec-b65a-d31440413bc9') }}
        </h1>
        <h1 v-else>
            {{ $t('3a50d90a-5780-46a9-8551-7dcec9ddb2de') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector"/>

        <STInputBox error-fields="amount" :error-box="errors.errorBox" class="max" :title="$t(`ab09a97a-20f7-4a90-8482-58be993bb12e`)">
            <NumberInput v-model="amount" :min="1" :stepper="true"/>
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('c567e65b-1fdd-4e0e-bf28-2cf3c1ab8e25') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, NumberInput, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { DiscountRequirement, PrivateWebshop, ProductSelector } from '@stamhoofd/structures';

import { computed } from 'vue';
import ProductSelectorBox from './ProductSelectorBox.vue';

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

function patchProductSelector(patch: AutoEncoderPatchType<ProductSelector>) {
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

</style>
