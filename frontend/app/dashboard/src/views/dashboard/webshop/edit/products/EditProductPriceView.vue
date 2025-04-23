<template>
    <SaveView :title="isNew ? $t(`Prijskeuze toevoegen`) : $t(`Prijskeuze bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('5da36b5d-903c-415e-a5bc-10c8a05038ae') }}
        </h1>
        <h1 v-else>
            {{ $t('4f42fede-70b7-46cd-9749-fbefdb744567') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ProductPriceBox :product-price="patchedProductPrice" :product="patched" :error-box="errors.errorBox" @patch="addPatch($event)" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('bf57e599-cac3-4b3c-a115-470efa0f3dea') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, STErrorsDefault, useErrors, usePatch } from '@stamhoofd/components';
import { Product, ProductPrice } from '@stamhoofd/structures';

import { computed } from 'vue';
import ProductPriceBox from './ProductPriceBox.vue';

const props = defineProps<{
    productPrice: ProductPrice;
    isNew: boolean;
    product: Product;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<Product>) => void);
}>();
const errors = useErrors();
const pop = usePop();

const { patch, hasChanges, patched, addPatch } = usePatch(props.product);

const patchedProductPrice = computed(() => {
    const c = patched.value.prices.find(c => c.id === props.productPrice.id);
    if (c) {
        return c;
    }
    return props.productPrice;
});

function save() {
    props.saveHandler(patch.value);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze prijskeuze wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p = Product.patch({});
    p.prices.addDelete(props.productPrice.id);
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
