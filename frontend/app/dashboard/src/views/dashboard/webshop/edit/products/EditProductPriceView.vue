<template>
    <SaveView :title="isNew ? $t(`%TR`) : $t(`%TS`)" :disabled="!hasChanges && !isNew" :loading="saveLoading" @save="save">
        <h1 v-if="isNew">
            {{ $t('%TR') }}
        </h1>
        <h1 v-else>
            {{ $t('%TS') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ProductPriceBox :product-price="patchedProductPrice" :is-new="isNew" :product="patched" :error-box="errors.errorBox" :validator="errors.validator" @patch="addPatch($event)" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%TT') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { Product, ProductPrice } from '@stamhoofd/structures';

import { useGetOfficialUitpasSocialTariff } from '@stamhoofd/components/uitpas/useGetOfficialUitpasSocialTariff.ts';
import { computed, ref } from 'vue';
import { useDeleteProductPrice } from '../hooks/useDeleteProductPrice';
import ProductPriceBox from './ProductPriceBox.vue';

const props = defineProps<{
    productPrice: ProductPrice;
    isNew: boolean;
    product: Product;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<Product>) => void);
}>();
const errors = useErrors();
const dismiss = useDismiss();
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
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }

    // if price changed and this is an UiTPAS base price we need to update the other product prices
    if (patched.value.uitpasEvent) {
        saveLoading.value = true;
        const uitpasEventUrl = patched.value.uitpasEvent.url;
        try {
            for (const productPrice of patched.value.prices.filter(p => !!p.uitpasBaseProductPriceId)) {
                let basePrice: number;
                if (productPrice.uitpasBaseProductPriceId === patchedProductPrice.value.id) {
                    // this is a UiTPAS base price, we need to update the social tariff prices
                    basePrice = patchedProductPrice.value.price;
                }
                else {
                    // also an update needed as the eventUrl might have been set
                    basePrice = patched.value.prices.find(p => p.id === productPrice.uitpasBaseProductPriceId)?.price ?? 0;
                }
                const newReducedPrice = await getOfficialUitpasSocialTariff(uitpasEventUrl, basePrice);
                addPricePatch(ProductPrice.patch({ id: productPrice.id, price: newReducedPrice }), productPrice.id);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        finally {
            saveLoading.value = false;
        }
    }
    props.saveHandler(patch.value);
    dismiss({ force: true })?.catch(console.error);
}

async function deleteMe() {
    const p = await deleteProductPrice(props.product, props.productPrice);
    if (!p) {
        return;
    }
    props.saveHandler(p);
    dismiss({ force: true })?.catch(console.error);
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
