<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`a9d8f27c-b4d3-415a-94a4-2ec3c018ee48`)"></STInputBox>

        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`e9f3660d-ab54-4f29-8c3f-85c756ac2ce0`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useDiscount"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('de0ccdf2-c48f-48b7-99ff-898c8312e930') }}
                </h3>
                <p v-if="useDiscount" class="style-description-small" @click.stop.prevent>
                    {{ $t("0d482afe-2a12-459a-ab4e-123b75ee4394") }}
                </p>

                <div v-if="useDiscount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="discountPrice" :error-box="errorBox" :title="$t(`01ee783e-6618-44d8-a996-d8a88cf6740a`)">
                        <PriceInput v-model="discountPrice" :min="null" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
                    </STInputBox>

                    <STInputBox error-fields="discountAmount" :error-box="errorBox" :title="$t(`ab36b950-37f5-4c0e-88b4-c8321d802744`)">
                        <NumberInput v-model="discountAmount" :min="2" :stepper="true" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('2cc2832f-7415-404c-9baf-b91ae0da4a77') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('5d3784bc-249c-4d3c-aa3a-456c30ffff44') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('083ceff7-ae68-4bd8-871a-6e4002991513') }} {{ usedStock }} {{ $t('e284d77b-c88c-4c0f-8464-58c4fe12eda8') }}
                </h3>

                <p v-if="useStock" class="style-description-small">
                    {{ $t('7ce15ac4-bde4-4893-8db7-e0d0ab030c79') }}
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errorBox">
                        <NumberInput v-model="stock"/>
                    </STInputBox>
                </div>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Checkbox, ErrorBox, NumberInput, PriceInput, STInputBox, STList, STListItem } from '@stamhoofd/components';
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
</script>
