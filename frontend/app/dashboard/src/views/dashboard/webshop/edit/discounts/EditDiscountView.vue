<template>
    <SaveView :title="isNew ? $t(`Korting toevoegen`) : $t(`Korting bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('80068224-902d-4e6b-9584-be2260b19f18') }}
        </h1>
        <h1 v-else>
            {{ $t('0d0b5b56-7561-4024-8df5-826cd6b1a1c8') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`4f60c233-cec7-45f2-ad56-bfb49dd53f56`)">
                <PriceInput v-model="fixedDiscount" :min="0" :required="true" :placeholder="$t(`0375d617-58bc-4fff-abbc-b73d4a3a1e28`)"/>
            </STInputBox>

            <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`2041e6a0-2f90-485e-8144-4169e0f7ff31`)">
                <PermyriadInput v-model="percentageDiscount" :required="true" :placeholder="$t(`2041e6a0-2f90-485e-8144-4169e0f7ff31`)"/>
            </STInputBox>
        </div>

        <p class="style-description-small">
            {{ $t('f2dfb2ca-691a-4ff3-bd16-157ccf4c1b85') }}
        </p>

        <hr><h2>
            {{ $t('6971a6f6-3bcc-4aa4-8f5d-49a7b25edfa9') }}
        </h2>
        <p>{{ $t('9680c881-cb91-4200-ac95-ac883dc25492') }}</p>

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
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addProductDiscount">
                <span class="icon add"/>
                <span>{{ $t('3c2b0f17-52bd-4b6b-8a83-d88218682a72') }}</span>
            </button>
        </p>

        <hr><h2>
            {{ $t('cc30665b-cdb4-46c1-a89d-ed72fef3bed9') }}
        </h2>
        <p>{{ $t('e5d721bb-eb1e-43ee-b640-3059326f12f2') }}</p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem v-for="requirement of patchedDiscount.requirements" :key="requirement.id" class="right-description right-stack" :selectable="true" @click="editRequirement(requirement)">
                <h3 class="style-title-list">
                    {{ requirement.amount }} x {{ requirement.product.getName(webshop, true).name }}
                </h3>
                <p class="style-description-small">
                    {{ requirement.product.getName(webshop, true).footnote }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addRequirement">
                <span class="icon add"/>
                <span>{{ $t('ba00f93d-1fb4-464e-b3cb-876db05831f1') }}</span>
            </button>
        </p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="applyMultipleTimes"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('baea82eb-99be-4ed0-a569-445d68c583dc') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('593fb8b6-f558-40a4-b37c-4033790b774a') }}
                </p>
            </STListItem>
        </STList>

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
