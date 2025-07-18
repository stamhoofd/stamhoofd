<template>
    <SaveView :title="isNew ? $t(`67605bca-eb74-4d32-8e81-c4c1d3c66105`) : $t(`da9a9438-6686-4740-806e-1f4958b3ff9f`)" :disabled="!hasChanges && !isNew" :loading="saveLoading" @save="save">
        <h1 v-if="isNew">
            {{ $t('5da36b5d-903c-415e-a5bc-10c8a05038ae') }}
        </h1>
        <h1 v-else>
            {{ $t('4f42fede-70b7-46cd-9749-fbefdb744567') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ProductPriceBox :product-price="patchedProductPrice" :is-new="isNew" :product="patched" :error-box="errors.errorBox" @patch="addPatch($event)" />

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
import { CenteredMessage, SaveView, STErrorsDefault, Toast, useErrors, usePatch } from '@stamhoofd/components';
import { Product, ProductPrice } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import ProductPriceBox from './ProductPriceBox.vue';
import { useDeleteProductPrice } from '@stamhoofd/components/src/context/hooks/useDeleteProductPrice';
import { useGetOfficialUitpasSocialTariff } from '@stamhoofd/components/src/context/hooks/useGetOfficialUitpasSocialTariff';

const props = defineProps<{
    productPrice: ProductPrice;
    isNew: boolean;
    product: Product;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<Product>) => void);
}>();
const errors = useErrors();
const pop = usePop();
const { deleteProductPrice } = useDeleteProductPrice();
const { getOfficialUitpasSocialTariff } = useGetOfficialUitpasSocialTariff();

const { patch, hasChanges, patched, addPatch } = usePatch(props.product);

const saveLoading = ref(false);

const patchedProductPrice = computed(() => {
    const c = patched.value.prices.find(c => c.id === props.productPrice.id);
    if (c) {
        return c;
    }
    return props.productPrice;
});

function addPricePatch(patch: AutoEncoderPatchType<ProductPrice>, productPriceId: string = patchedProductPrice.value.id) {
    const p = Product.patch({});
    p.prices.addPatch(ProductPrice.patch(Object.assign({}, patch, { id: productPriceId })));
    addPatch(p);
}

async function save() {
    // if price changed and this is an UiTPAS base price we need to update the other product prices
    if (!patched.value.uitpasEventId) {
        return; // not for non-official flow
    }
    saveLoading.value = true;
    const uitpasEventId = patched.value.uitpasEventId;
    try {
        for (const productPrice of patched.value.prices) {
            if (productPrice.uitpasBaseProductPriceId === patchedProductPrice.value.id) {
                console.error(productPrice.name);
                // this is a UiTPAS base price, we need to update the social tariff prices
                const newReducedPrice = await getOfficialUitpasSocialTariff(uitpasEventId, patchedProductPrice.value.price);
                addPricePatch(ProductPrice.patch({ id: productPrice.id, price: newReducedPrice }), productPrice.id);
            }
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        saveLoading.value = false;
    }
    props.saveHandler(patch.value);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    const p = await deleteProductPrice(props.product, props.productPrice);
    if (!p) {
        return;
    }
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
