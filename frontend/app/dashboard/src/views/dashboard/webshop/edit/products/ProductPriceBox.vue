<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`1539d481-12bf-4814-9fe3-3770eaecdda8`)">
        </STInputBox>

        <STInputBox error-fields="price" :error-box="errorBox" :title="$t(`52bff8d2-52af-4d3f-b092-96bcfa4c0d03`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
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
