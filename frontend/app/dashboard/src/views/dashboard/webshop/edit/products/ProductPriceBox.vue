<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errorBox" :title="$t(`%Gq`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%Sk`)">
        </STInputBox>

        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`%1IP`)">
            <LoadingInputBox :loading="uitpasSocialTariffLoading">
                <PriceInput v-model="price" :min="null" :placeholder="$t(`%1Mn`)" :disabled="!!product.uitpasEvent && enableUitpasSocialTariff" />
            </LoadingInputBox>
            <p v-if="!!product.uitpasEvent" class="style-description-small">
                {{ $t('%1AL') }}
            </p>
        </STInputBox>

        <STList>
            <STListItem v-if="discountPossible" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useDiscount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%U7') }}
                </h3>

                <p v-if="useDiscount" class="style-description-small" @click.stop.prevent>
                    {{ $t("%U9") }}
                </p>
                <p v-if="!discountPossible" class="style-description-small" @click.stop.prevent>
                    {{ $t('%1C2') }}
                </p>

                <div v-if="useDiscount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`%UA`)">
                        <PriceInput v-model="discountPrice" :min="null" :placeholder="$t(`%1Mn`)" />
                    </STInputBox>

                    <STInputBox error-fields="discountAmount" :error-box="errorBox" :title="$t(`%UB`)">
                        <NumberInput v-model="discountAmount" :min="2" :stepper="true" :placeholder="$t(`%1Mn`)" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%Ti') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('%U8') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%TN', {stock: usedStock.toString()}) }}
                </h3>

                <p v-if="useStock" class="style-description-small">
                    {{ $t('%TO') }}
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errorBox">
                        <NumberInput v-model="stock" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="uitpasFeature && (!isSingle || enableUitpasSocialTariff)" :selectable="true" element-name="label" :disabled="productPricesAvailableForUitpasBaseProductPrice.length === 0">
                <template #left>
                    <Checkbox v-model="enableUitpasSocialTariff" :disabled="productPricesAvailableForUitpasBaseProductPrice.length === 0" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1AM') }}
                </h3>

                <p v-if="productPricesAvailableForUitpasBaseProductPrice.length === 0" class="style-description-small">
                    {{ patchedProduct.prices.some(p => p.uitpasBaseProductPriceId === patchedProductPrice.id) ? $t('%1AN') : $t('%1AO') }}
                </p>

                <STInputBox v-if="uitpasBaseProductPriceId" error-fields="uitpasBaseProductPriceId" :error-box="errorBox" :title="$t('%1AP')">
                    <Dropdown v-model="uitpasBaseProductPriceId">
                        <option v-for="item in productPricesAvailableForUitpasBaseProductPrice" :key="item.id" :value="item.id">
                            {{ item.name ? item.name + ' (' + formatPrice(item.price) + ')' : formatPrice(item.price) }}
                        </option>
                    </Dropdown>

                    <p class="style-description-small">
                        {{ $t('%1AQ') }}
                    </p>
                </STInputBox>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import NumberInput from '@stamhoofd/components/inputs/NumberInput.vue';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import LoadingInputBox from '@stamhoofd/components/navigation/LoadingInputBox.vue';
import { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { Product, ProductPrice } from '@stamhoofd/structures';
import { computed, onMounted, ref, watch } from 'vue';
import { useGetOfficialUitpasSocialTariff } from '@stamhoofd/components/uitpas/useGetOfficialUitpasSocialTariff.ts';
import { useGoToUitpasConfiguration } from '@stamhoofd/components/uitpas/useGoToUitpasConfiguration.ts';

const { getOfficialUitpasSocialTariff } = useGetOfficialUitpasSocialTariff();

const props = defineProps<{
    errorBox: ErrorBox | null;
    productPrice: ProductPrice;
    product: Product;
    isNew: boolean;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<Product>): void }>();
const uitpasFeature = useFeatureFlag()('uitpas');

const patchedProductPrice = computed(() => props.productPrice);
const patchedProduct = computed(() => props.product);
function addProductPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Product>>) {
    emits('patch', Product.patch({ id: props.product.id }).patch(Product.patch(patch)));
}
const { goToUitpasConfiguration } = useGoToUitpasConfiguration(patchedProduct, addProductPatch);

const uitpasSocialTariffLoading = ref(false);

const discountPossible = computed(() => {
    // if not UiTPAS social tariff
    return !patchedProductPrice.value.uitpasBaseProductPriceId;
});

onMounted(async () => {
    if (props.isNew) {
        await updateUitpasSocialTariff();
    }
    // if not new, we display the cached price
});

const name = computed({
    get: () => patchedProductPrice.value.name,
    set: (name: string) => {
        addPricePatch(ProductPrice.patch({ name }));
    },
});

const price = computed({
    get: () => patchedProductPrice.value.price,
    set: (price: number) => {
        addPricePatch(ProductPrice.patch({ price }));
    },
});

const discountAmount = computed({
    get: () => patchedProductPrice.value.discountAmount,
    set: (discountAmount: number) => {
        addPricePatch(ProductPrice.patch({ discountAmount }));
    },
});

const discountPrice = computed({
    get: () => patchedProductPrice.value.discountPrice,
    set: (discountPrice: number | null) => {
        addPricePatch(ProductPrice.patch({ discountPrice }));
    },
});

const useDiscount = computed({
    get: () => patchedProductPrice.value.discountPrice !== null,
    set: (value: boolean) => {
        if (value === useDiscount.value) {
            return;
        }
        if (value) {
            discountPrice.value = price.value;
        }
        else {
            discountPrice.value = null;
        }
    },
});

const hidden = computed({
    get: () => patchedProductPrice.value.hidden,
    set: (hidden: boolean) => {
        addPricePatch(ProductPrice.patch({ hidden }));
    },
});

const useStock = computed({
    get: () => patchedProductPrice.value.stock !== null,
    set: (useStock: boolean) => {
        addPricePatch(ProductPrice.patch({ stock: useStock ? (patchedProductPrice.value.stock ?? patchedProductPrice.value.stock ?? (patchedProductPrice.value.usedStock || 10)) : null }));
    },
});

const stock = computed({
    get: () => patchedProductPrice.value.stock,
    set: (stock: number | null) => {
        addPricePatch(ProductPrice.patch({ stock }));
    },
});

const usedStock = computed(() => patchedProductPrice.value.usedStock);

function addPricePatch(patch: AutoEncoderPatchType<ProductPrice>) {
    const p = Product.patch({});
    p.prices.addPatch(ProductPrice.patch(Object.assign({}, patch, { id: patchedProductPrice.value.id })));
    emits('patch', p);
}

const isSingle = computed(() => patchedProduct.value.prices.length <= 1);

const uitpasBaseProductPriceId = computed({
    get: () => patchedProductPrice.value.uitpasBaseProductPriceId,
    set: (value: string | null) => {
        if (value === patchedProductPrice.value.uitpasBaseProductPriceId) {
            return; // no change
        }
        if (value) {
            if (!name.value) {
                // If no name is set for this price, we suggest the name UiTPAS kansentarief.
                name.value = 'UiTPAS kansentarief';
            }
            useDiscount.value = false; // Disable discount if uitpas social tariff is enabled
        }
        addPricePatch(ProductPrice.patch({ uitpasBaseProductPriceId: value }));
    },
});

watch(uitpasBaseProductPriceId, updateUitpasSocialTariff);

async function updateUitpasSocialTariff() {
    if (!uitpasBaseProductPriceId.value) {
        // If no uitpas base product price is set, we do not need to update the social tariff.
        return;
    }
    if (patchedProduct.value.uitpasEvent) {
        // official flow
        uitpasSocialTariffLoading.value = true;
        const basePrice = patchedProduct.value.prices.find(p => p.id === uitpasBaseProductPriceId.value)?.price ?? 0;
        try {
            price.value = await getOfficialUitpasSocialTariff(patchedProduct.value.uitpasEvent.url, basePrice);
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        finally {
            uitpasSocialTariffLoading.value = false;
        }
    }
}

const enableUitpasSocialTariff = computed({
    get: () => uitpasBaseProductPriceId.value !== null,
    set: (isUitpasSocialTariff: boolean) => {
        if (!isUitpasSocialTariff) {
            uitpasBaseProductPriceId.value = null;
            return;
        }
        if (uitpasBaseProductPriceId.value) {
            // Already enabled, no need to do anything
            return;
        }
        goToUitpasConfiguration(async (navigationActions?: NavigationActions) => {
            if (navigationActions) {
                await navigationActions.dismiss();
            }
            if (!name.value) {
                name.value = 'UiTPAS kansentarief';
            }
            uitpasBaseProductPriceId.value = productPricesAvailableForUitpasBaseProductPrice.value[0]?.id ?? null;
        }).catch((e) => {
            Toast.fromError(e).show();
        });
    },
});

const productPricesAvailableForUitpasBaseProductPrice = computed(() => {
    if (patchedProduct.value.prices.some(p => p.uitpasBaseProductPriceId === patchedProductPrice.value.id)) {
        // This price is already a base price for another uitpas social tariff, so it cannot be a UiTPAS social tariff.
        return [];
    }
    return patchedProduct.value.prices.filter(p => (p.uitpasBaseProductPriceId === null && p.id !== patchedProductPrice.value.id));
});

</script>
<style lang="scss">
    .input-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
    }

    .input.with-spinner {
    padding-right: 2.5em; /* space for the spinner */
    }

    .spinner-inside-input {
    position: absolute;
    right: 0.75em;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none; /* let clicks go through to the input */
    }
</style>
