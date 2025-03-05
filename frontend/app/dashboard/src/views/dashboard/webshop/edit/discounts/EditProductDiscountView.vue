<template>
    <SaveView :title="isNew ? $t(`Productkorting toevoegen`) : $t(`Productkorting bewerken`)" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('9f2324d2-2e98-446d-84b8-783f137945d6') }}
        </h1>
        <h1 v-else>
            {{ $t('11ecb8e4-9d2b-419a-a2c5-96f9636ef1ae') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector"/>

        <hr><h2>{{ $t('7cfe6205-1f1c-42b4-82ce-8e6d8869e253') }}</h2>
        <p v-if="discounts.length > 1">
            {{ $t("ce279ec5-0673-4091-b306-9e88765e5f54") }}
        </p>

        <div v-for="(d, index) in discounts" :key="d.id">
            <STInputBox :title="discounts.length === 1 ? $t(`Korting`) : $t(`939bd7e3-ee2d-4c46-9841-4be436c47095`) + ' '+(index+1)+$t(`eced09d7-8a02-4c69-93f9-d88f7dad092e`) + ((repeatBehaviour === 'RepeatLast' && index === discounts.length - 1) ? ' ' + $t(`97d81f21-16f0-4d33-afb1-acf2c6777567`) : '')" :error-box="errors.errorBox" class="max">
                <template v-if="discounts.length > 1" #right>
                    <button class="button icon trash gray" type="button" @click="removeDiscount(d)"/>
                </template>

                <div class="split-inputs">
                    <div>
                        <PriceInput v-if="getDiscountType(d) === 'discountPerPiece'" :model-value="getDiscountDiscountPerPiece(d)" :min="0" :required="true" @update:model-value="setDiscountDiscountPerPiece(d, $event)"/>
                        <PermyriadInput v-else :model-value="getDiscountPercentageDiscount(d)" :required="true" @update:model-value="setDiscountPercentageDiscount(d, $event)"/>
                    </div>
                    <div>
                        <Dropdown :model-value="getDiscountType(d)" @update:model-value="setDiscountType(d, $event)">
                            <option value="percentageDiscount">
                                {{ $t('2041e6a0-2f90-485e-8144-4169e0f7ff31') }}
                            </option>
                            <option value="discountPerPiece">
                                {{ $t('ec09a8ac-1c47-4b41-b974-fbdb91bd5477') }}
                            </option>
                        </Dropdown>
                    </div>
                </div>
            </STInputBox>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add"/>
                <span v-if="discounts.length === 1">{{ $t('4c7baa48-c217-4875-8168-6f358b7498d5') }}</span>
                <span v-else>{{ $t('73b74929-78f4-4cfa-8a20-92a071a84ec5') }}</span>
            </button>
        </p>

        

        <hr><h2>{{ $t('7de621c8-b77a-481e-ac3c-87398826ac5d') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="Once"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('aa2edfd6-c02a-4471-8aad-07b52b4e4b24') }}
                </h3>
                <p class="style-description">
                    {{ $t('5fc5b1c5-9233-4277-9dd8-5df0a138ce38') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatLast"/>
                </template>
                <h3 v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" class="style-title-list">
                    {{ $t('cae72370-67c9-4cad-8e40-2fcd58807a18') }}
                </h3>
                <h3 v-else>
                    {{ $t('7de621c8-b77a-481e-ac3c-87398826ac5d') }}
                </h3>
                <p class="style-description">
                    {{ $t('2ba4ac5e-c236-4da8-8c35-a55e4316d2f8') }}
                </p>
            </STListItem>

            <STListItem v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatPattern"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('ec1fcafa-fb60-456f-b1ec-b4a497e008b4') }}
                </h3>
                <p class="style-description">
                    {{ $t('6e7e7b1e-67db-46f8-a75d-4e1ffa9cc5c9') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('430c2347-afbf-4caa-adbc-bffc294907ad') }}</h2>
        <p>{{ $t("0388c7cf-5df1-44d0-99c2-a6986cc77fe9") }}</p>

        <STInputBox error-fields="cartLabel" :error-box="errors.errorBox" :title="$t(`bd10ebec-0d61-4b2d-9d76-4c60d8884aea`)">
            <input v-model="cartLabel" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"></STInputBox>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('a9c5cb42-61c2-452f-957d-08fd61175f56') }}
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
