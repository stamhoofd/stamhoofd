<template>
    <SaveView :title="isNew ? $t(`Productkorting toevoegen`) : $t(`Productkorting bewerken`)" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('72b723a2-72c5-4d56-8129-519ea281c6b7') }}
        </h1>
        <h1 v-else>
            {{ $t('82b145c8-177b-4073-8e28-3781fc902b15') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector" />

        <hr><h2>{{ $t('f177a8e3-ae76-4894-af0a-56936b79100f') }}</h2>
        <p v-if="discounts.length > 1">
            {{ $t("91c71d21-b5bc-4b91-bc08-5ac39db87b95") }}
        </p>

        <div v-for="(d, index) in discounts" :key="d.id">
            <STInputBox :title="discounts.length === 1 ? $t(`Korting`) : $t(`bffce456-034e-4768-bd64-e0c1061e685a`) + ' '+(index+1)+$t(`9e90b5f1-bac8-4e6e-b171-d679b3959197`) + ((repeatBehaviour === 'RepeatLast' && index === discounts.length - 1) ? ' ' + $t(`049a16f3-a8dd-485e-9696-afa9fdb511b8`) : '')" :error-box="errors.errorBox" class="max">
                <template v-if="discounts.length > 1" #right>
                    <button class="button icon trash gray" type="button" @click="removeDiscount(d)" />
                </template>

                <div class="split-inputs">
                    <div>
                        <PriceInput v-if="getDiscountType(d) === 'discountPerPiece'" :model-value="getDiscountDiscountPerPiece(d)" :min="0" :required="true" @update:model-value="setDiscountDiscountPerPiece(d, $event)" />
                        <PermyriadInput v-else :model-value="getDiscountPercentageDiscount(d)" :required="true" @update:model-value="setDiscountPercentageDiscount(d, $event)" />
                    </div>
                    <div>
                        <Dropdown :model-value="getDiscountType(d)" @update:model-value="setDiscountType(d, $event)">
                            <option value="percentageDiscount">
                                {{ $t('dd61d33b-367e-4e40-8ac6-84c286b931bc') }}
                            </option>
                            <option value="discountPerPiece">
                                {{ $t('a023893e-ab2c-4215-9981-76ec16336911') }}
                            </option>
                        </Dropdown>
                    </div>
                </div>
            </STInputBox>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span v-if="discounts.length === 1">{{ $t('02ff0e29-3e68-45a3-99af-da52a3f74ed8') }}</span>
                <span v-else>{{ $t('36ba68cb-2159-4179-8ded-89e73d47cd87') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t('1c61441b-b85a-4200-8a87-500150bcd482') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="Once" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('9229847f-1eab-478c-bd4f-2af64b19fbcb') }}
                </h3>
                <p class="style-description">
                    {{ $t('dd051de6-5748-403b-aeff-d09f0dc6c588') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatLast" />
                </template>
                <h3 v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" class="style-title-list">
                    {{ $t('0dd837cf-6c0d-47eb-8e03-c0fc33fed753') }}
                </h3>
                <h3 v-else>
                    {{ $t('1c61441b-b85a-4200-8a87-500150bcd482') }}
                </h3>
                <p class="style-description">
                    {{ $t('ce9b3654-64cc-489d-bad7-9e390083fac1') }}
                </p>
            </STListItem>

            <STListItem v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatPattern" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('ebc96c58-0295-43a1-b7a0-3e44d138b880') }}
                </h3>
                <p class="style-description">
                    {{ $t('e67f5cbb-c958-48c0-a832-393be5cdcba6') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('7656725b-2032-4944-b0ca-d5209f8eaa78') }}</h2>
        <p>{{ $t("8914f29c-dd1f-4750-8ae5-3ce6ea28e1b5") }}</p>

        <STInputBox error-fields="cartLabel" :error-box="errors.errorBox" :title="$t(`f64ba2c0-b20e-4aa5-94d2-ff2a3173ee51`)">
            <input v-model="cartLabel" class="input" type="text" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)">
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('f86309f9-1830-4aff-858c-a8b9d52053b4') }}
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
import { CenteredMessage, Dropdown, PermyriadInput, PriceInput, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, usePatch } from '@stamhoofd/components';
import { PrivateWebshop, ProductDiscount, ProductDiscountRepeatBehaviour, ProductDiscountSettings, ProductSelector } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import ProductSelectorBox from './ProductSelectorBox.vue';

const props = defineProps<{
    productDiscount: ProductDiscountSettings;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => void;
}>();
const errors = useErrors();
const pop = usePop();

const { patch: patchProductDiscount, patched: patchedProductDiscount, addPatch, hasChanges } = usePatch(props.productDiscount);

const cachedDiscountType = ref<Map<string, 'percentageDiscount' | 'discountPerPiece'>>(new Map());
const productSelector = computed(() => patchedProductDiscount.value.product);

function patchProductSelector(patch: AutoEncoderPatchType<ProductSelector>) {
    addPatch(ProductDiscountSettings.patch({
        product: patch,
    }));
}

const discounts = computed(() => patchedProductDiscount.value.discounts as unknown as ProductDiscount[]);

const repeatBehaviour = computed({
    get: () => patchedProductDiscount.value.repeatBehaviour,
    set: (repeatBehaviour: ProductDiscountRepeatBehaviour | undefined) => {
        addPatch(ProductDiscountSettings.patch({
            repeatBehaviour,
        }));
    } });

const cartLabel = computed({
    get: () => patchedProductDiscount.value.cartLabel ?? '',
    set: (cartLabel: string) => {
        addPatch(ProductDiscountSettings.patch({
            cartLabel: cartLabel || null,
        }));
    },
});

function getDiscountType(d: ProductDiscount) {
    if (cachedDiscountType.value.has(d.id)) {
        return cachedDiscountType.value.get(d.id);
    }

    if (d.discountPerPiece > 0) {
        return 'discountPerPiece';
    }
    return 'percentageDiscount';
}

function setDiscountType(d: ProductDiscount, type: 'percentageDiscount' | 'discountPerPiece') {
    cachedDiscountType.value.set(d.id, type);

    const p = ProductDiscountSettings.patch({});
    if (type === 'percentageDiscount') {
        p.discounts.addPatch(ProductDiscount.patch({
            id: d.id,
            percentageDiscount: Math.min(100, getDiscountDiscountPerPiece(d)),
            discountPerPiece: 0,
        }));
    }
    else {
        p.discounts.addPatch(ProductDiscount.patch({
            id: d.id,
            percentageDiscount: 0,
            discountPerPiece: Math.max(1, getDiscountPercentageDiscount(d)),
        }));
    }
    addPatch(p);
}

function getDiscountDiscountPerPiece(d: ProductDiscount) {
    return d.discountPerPiece;
}

function setDiscountDiscountPerPiece(d: ProductDiscount, discountPerPiece: number) {
    const p = ProductDiscountSettings.patch({});
    p.discounts.addPatch(ProductDiscount.patch({
        id: d.id,
        percentageDiscount: 0,
        discountPerPiece: discountPerPiece,
    }));
    addPatch(p);
}

function getDiscountPercentageDiscount(d: ProductDiscount) {
    return d.percentageDiscount;
}

function setDiscountPercentageDiscount(d: ProductDiscount, percentageDiscount: number) {
    const p = ProductDiscountSettings.patch({});
    p.discounts.addPatch(ProductDiscount.patch({
        id: d.id,
        percentageDiscount,
        discountPerPiece: 0,
    }));
    addPatch(p);
}

function addDiscount() {
    const p = ProductDiscountSettings.patch({});
    p.discounts.addPut(ProductDiscount.create({}));
    addPatch(p);
}

function removeDiscount(discount: ProductDiscount) {
    const p = ProductDiscountSettings.patch({});
    p.discounts.addDelete(discount.id);
    addPatch(p);
}

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray();
    p.addPatch(patchProductDiscount.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze korting wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray();
    p.addDelete(props.productDiscount.id);
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
