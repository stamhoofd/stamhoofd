<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`1539d481-12bf-4814-9fe3-3770eaecdda8`)">
        </STInputBox>

        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" :disabled="false /* for official UiTPAS flow */ " />
            <p v-if="false /* for official UiTPAS flow */ " class="style-description-small">
                {{ $t('Jouw UiTPAS regio bepaalt het kansentarief op basis van je gekozen basisprijs.') }}
            </p>
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useDiscount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('3eaf07f2-4c9f-418a-b494-95b26a2352da') }}
                </h3>
                <p v-if="useDiscount" class="style-description-small" @click.stop.prevent>
                    {{ $t("a44947d8-7021-4398-ad41-7067dac8ae64") }}
                </p>

                <div v-if="useDiscount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`a9f97aed-ed48-41b7-a2d3-9bbab28981d8`)">
                        <PriceInput v-model="discountPrice" :min="null" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
                    </STInputBox>

                    <STInputBox error-fields="discountAmount" :error-box="errorBox" :title="$t(`f4306def-3d82-420c-98d5-795879461006`)">
                        <NumberInput v-model="discountAmount" :min="2" :stepper="true" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('9b385bc1-0c3b-4476-b31d-a8598e381ca4') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('5bd19019-212a-4c0a-9f22-4eb38b3699df') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('45807c1e-fb46-496f-9584-9081c56e193c', {stock: usedStock.toString()}) }}
                </h3>

                <p v-if="useStock" class="style-description-small">
                    {{ $t('31a4cf98-1e98-491e-855c-2b5a5703b254') }}
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errorBox">
                        <NumberInput v-model="stock" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || enableUitpasSocialTariff /* useUitpasSocialTariff=true, should not be possible */" :selectable="true" element-name="label" :disabled="productPricesAvailableForUitpasBaseProductPrice.length === 0">
                <template #left>
                    <Checkbox v-model="enableUitpasSocialTariff" :disabled="productPricesAvailableForUitpasBaseProductPrice.length === 0" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Verplicht het invullen van een UiTPAS-nummer met kansentarief') }}
                </h3>

                <p v-if="productPricesAvailableForUitpasBaseProductPrice.length === 0" class="style-description-small">
                    {{ props.product.prices.some(p => p.uitpasBaseProductPriceId === props.productPrice.id) ? $t('Deze prijs is reeds een basisprijs voor een ander UiTPAS kansentarief') : $t('Een UiTPAS kansentarief, heeft een basisprijs nodig.') }}
                </p>

                <STInputBox v-if="uitpasBaseProductPriceId" error-fields="uitpasBaseProductPriceId" :error-box="errorBox" :title="$t('Basisprijs')" :description="$t('Elk UiTPAS-kansentarief moet een basisprijs hebben, dit is de prijs die men zou betalen zonder kansentarief.')">
                    <Dropdown v-model="uitpasBaseProductPriceId">
                        <option v-for="item in productPricesAvailableForUitpasBaseProductPrice" :key="item.id" :value="item.id">
                            {{ item.name ? item.name + ' (' + formatPrice(item.price) + ')' : formatPrice(item.price) }}
                        </option>
                    </Dropdown>

                    <p class="style-description-small">
                        {{ $t('Elk UiTPAS-kansentarief moet een basisprijs hebben, dit is de prijs die men zou betalen zonder kansentarief.') }}
                    </p>
                </STInputBox>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Checkbox, ErrorBox, NumberInput, PriceInput, STInputBox, STList, STListItem, Dropdown, Toast } from '@stamhoofd/components';
import { Product, ProductPrice } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    errorBox: ErrorBox | null;
    productPrice: ProductPrice;
    product: Product;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<Product>): void }>();

const patchedProductPrice = computed(() => props.productPrice);

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
    p.prices.addPatch(ProductPrice.patch(Object.assign({}, patch, { id: props.productPrice.id })));
    emits('patch', p);
}

const isSingle = computed(() => props.product.prices.length <= 1);

const uitpasBaseProductPriceId = computed({
    get: () => patchedProductPrice.value.uitpasBaseProductPriceId,
    set: (value: string | null) => {
        if (value === patchedProductPrice.value.uitpasBaseProductPriceId) {
            return;
        }

        // If no name is set for this price, we suggest the name UiTPAS kansentarief.
        if (!name.value) {
            name.value = 'UiTPAS kansentarief';
        }
        /* We could suggest a name based on the base price, but there are a lot of edge cases.

        const basePriceName = props.product.prices.find(p => p.id === value)?.name;
        const suggestedPriceName = 'UiTPAS kansentarief' + (basePriceName ? ' ' + basePriceName : '');
        if (name.value) {
            const oldBasePriceName = props.product.prices.find(p => p.id === patchedProductPrice.value.uitpasBaseProductPriceId)?.name;
            const oldSuggestedPriceName = 'UiTPAS kansentarief' + (oldBasePriceName ? ' ' + oldBasePriceName : '');
            if (name.value === oldSuggestedPriceName) {
                name.value = suggestedPriceName;
            }
        }
        else {
            name.value = suggestedPriceName;
        }
        */
        addPricePatch(ProductPrice.patch({ uitpasBaseProductPriceId: value }));
    },
});

const enableUitpasSocialTariff = computed({
    get: () => uitpasBaseProductPriceId.value !== null,
    set: (isUitpasSocialTariff: boolean) => {
        if (!isUitpasSocialTariff) {
            uitpasBaseProductPriceId.value = null;
            return;
        }
        if (productPricesAvailableForUitpasBaseProductPrice.value.length === 0) {
            // This should never be possible
            Toast.error($t('Géén enkele andere prijs is beschikbaar als basisprijs')).show();
            console.error('No uitpas base product price available, setting to null');
            uitpasBaseProductPriceId.value = null;
            return;
        }
        uitpasBaseProductPriceId.value = productPricesAvailableForUitpasBaseProductPrice.value[0].id;
    },
});

const productPricesAvailableForUitpasBaseProductPrice = computed(() => {
    if (props.product.prices.some(p => p.uitpasBaseProductPriceId === props.productPrice.id)) {
        // This price is already a base price for another uitpas social tariff, so it cannot be a UiTPAS social tariff.
        return [];
    }
    return props.product.prices.filter(p => (p.uitpasBaseProductPriceId === null && p.id !== patchedProductPrice.value.id));
});

</script>
