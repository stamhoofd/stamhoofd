<template>
    <SaveView :title="isNew ? $t(`Korting toevoegen`) : $t(`Korting bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('46681ff6-bc40-4da6-9c3f-f8f335d72633') }}
        </h1>
        <h1 v-else>
            {{ $t('2e07e502-3239-4d75-bf62-ed65a619dfa7') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`6811d233-19c2-4e32-9900-6f138d818588`)">
                <PriceInput v-model="fixedDiscount" :min="0" :required="true" :placeholder="$t(`f67ccf42-d4a8-4fe6-b7dc-91f43726646e`)" />
            </STInputBox>

            <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`dd61d33b-367e-4e40-8ac6-84c286b931bc`)">
                <PermyriadInput v-model="percentageDiscount" :required="true" :placeholder="$t(`dd61d33b-367e-4e40-8ac6-84c286b931bc`)" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            {{ $t('f4350366-03b5-4d0f-8bd5-a03672e347f5') }}
        </p>

        <hr><h2>
            {{ $t('d4ee2fbb-f8a8-4497-ba1e-98aee9a4d979') }}
        </h2>
        <p>{{ $t('9c89b752-8949-4fba-86f2-2da04c7a9485') }}</p>

        <STList v-if="patchedDiscount.productDiscounts.length">
            <STListItem v-for="productDiscount of patchedDiscount.productDiscounts" :key="productDiscount.id" class="right-description right-stack" :selectable="true" @click="editProductDiscount(productDiscount)">
                <h3 class="style-title-list">
                    {{ productDiscount.getTitle(webshop, true).title }}
                </h3>
                <p class="style-description-small">
                    {{ productDiscount.getTitle(webshop, true).description }}
                </p>
                <p class="style-description-small">
                    {{ productDiscount.getTitle(webshop, true).footnote }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addProductDiscount">
                <span class="icon add" />
                <span>{{ $t('dfdcd5e4-c2a2-4667-b77b-435eef982693') }}</span>
            </button>
        </p>

        <hr><h2>
            {{ $t('17dd48e6-a63e-4c3c-9636-c9abd8ce429c') }}
        </h2>
        <p>{{ $t('205c5904-64f1-4c90-9960-86bdccbafc7a') }}</p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem v-for="requirement of patchedDiscount.requirements" :key="requirement.id" class="right-description right-stack" :selectable="true" @click="editRequirement(requirement)">
                <h3 class="style-title-list">
                    {{ requirement.amount }} x {{ requirement.product.getName(webshop, true).name }}
                </h3>
                <p class="style-description-small">
                    {{ requirement.product.getName(webshop, true).footnote }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addRequirement">
                <span class="icon add" />
                <span>{{ $t('a00e405f-c19b-4ce6-aafc-eb55b0406d0d') }}</span>
            </button>
        </p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="applyMultipleTimes" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('9fced9b2-f88d-45e4-a789-b9488e6894c3') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('dbcdd41b-c566-4356-9409-3668f1e7559a') }}
                </p>
            </STListItem>
        </STList>

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
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, PermyriadInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, usePatch } from '@stamhoofd/components';
import { Discount, DiscountRequirement, GeneralDiscount, PrivateWebshop, ProductDiscountSettings, ProductSelector } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditDiscountRequirementView from './EditDiscountRequirementView.vue';
import EditProductDiscountView from './EditProductDiscountView.vue';

const props = defineProps<{
    discount: Discount;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => void;
}>();

const errors = useErrors();
const present = usePresent();
const pop = usePop();

const { patch: patchDiscount, patched: patchedDiscount, addPatch, hasChanges } = usePatch(props.discount);

const applyMultipleTimes = computed({
    get: () => patchedDiscount.value.applyMultipleTimes,
    set: (applyMultipleTimes: boolean) => {
        addPatch(Discount.patch({
            applyMultipleTimes,
        }));
    },
});

const fixedDiscount = computed({
    get: () => patchedDiscount.value.orderDiscount.fixedDiscount,
    set: (fixedDiscount: number) => {
        addPatch(Discount.patch({
            orderDiscount: GeneralDiscount.patch({
                fixedDiscount,
            }),
        }));
    },
});

const percentageDiscount = computed({
    get: () => patchedDiscount.value.orderDiscount.percentageDiscount,
    set: (percentageDiscount: number) => {
        addPatch(Discount.patch({
            orderDiscount: GeneralDiscount.patch({
                percentageDiscount,
            }),
        }));
    },
});

function addRequirementsPatch(d: PatchableArrayAutoEncoder<DiscountRequirement>) {
    const meta = Discount.patch({
        requirements: d,
    });
    addPatch(meta);
}

function addProductDiscountPatch(d: PatchableArrayAutoEncoder<ProductDiscountSettings>) {
    const meta = Discount.patch({
        productDiscounts: d,
    });
    addPatch(meta);
}

function addRequirement() {
    const requirement = DiscountRequirement.create({
        product: ProductSelector.create({
            productId: props.webshop.products[0].id,
        }),
    });
    const arr: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
    arr.addPut(requirement);

    present({
        components: [
            new ComponentWithProperties(EditDiscountRequirementView, {
                isNew: true,
                discountRequirement: requirement,
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => {
                    arr.merge(patch);
                    addRequirementsPatch(arr);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editRequirement(discountRequirement: DiscountRequirement) {
    present({
        components: [
            new ComponentWithProperties(EditDiscountRequirementView, {
                isNew: false,
                discountRequirement: discountRequirement,
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => {
                    addRequirementsPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function addProductDiscount() {
    const productDiscount = ProductDiscountSettings.create({
        product: ProductSelector.create({
            productId: props.webshop.products[0].id,
        }),
    });
    const arr: PatchableArrayAutoEncoder<ProductDiscountSettings> = new PatchableArray();
    arr.addPut(productDiscount);

    present({
        components: [
            new ComponentWithProperties(EditProductDiscountView, {
                isNew: true,
                productDiscount,
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => {
                    arr.merge(patch);
                    addProductDiscountPatch(arr);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editProductDiscount(productDiscount: ProductDiscountSettings) {
    present({
        components: [
            new ComponentWithProperties(EditProductDiscountView, {
                isNew: false,
                productDiscount,
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<ProductDiscountSettings>) => {
                    addProductDiscountPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
    p.addPatch(patchDiscount.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze korting wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
    p.addDelete(props.discount.id);
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
