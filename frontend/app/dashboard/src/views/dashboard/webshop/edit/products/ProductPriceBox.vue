<template>
    <div>
        <STInputBox v-if="!isSingle" title="Naam" error-fields="name" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze keuze"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Prijs" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" :min="null" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useDiscount" />
                </template>

                <h3 class="style-title-list">
                    Korting vanaf een bepaald aantal stuks
                </h3>
                <p v-if="useDiscount" class="style-description-small" @click.stop.prevent>
                    De prijs met korting wordt op het totale aantal toegepast. Als je keuzemenu's en meerdere prijzen hebt, dan tellen we de aantallen met andere keuzes op om het totaal te bepalen (bv. één grote spaghetti met kaas en één kleine spaghetti zonder kaas → telt als twee spaghetti's). Als je dat niet wilt voeg je beter verschillende producten toe.
                </p>

                <div v-if="useDiscount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="Prijs met korting" error-fields="discountPrice" :error-box="errorBox">
                        <PriceInput v-model="discountPrice" placeholder="Gratis" :min="null" />
                    </STInputBox>

                    <STInputBox title="Vanaf aantal stuks" error-fields="discountAmount" :error-box="errorBox">
                        <NumberInput v-model="discountAmount" placeholder="Gratis" :min="2" :stepper="true" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    Verbergen op webshop
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Deze keuze wordt onzichtbaar op de webshop en is enkel te bestellen door manueel een bestelling in te geven als beheerder.
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} verkocht of gereserveerd)
                </h3>

                <p v-if="useStock" class="style-description-small">
                    Geannuleerde en verwijderde bestellingen worden niet meegerekend.
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
