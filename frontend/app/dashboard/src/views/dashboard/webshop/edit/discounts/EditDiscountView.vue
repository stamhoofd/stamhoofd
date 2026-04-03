<template>
    <SaveView :title="isNew ? $t(`%S5`) : $t(`%SA`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('%S5') }}
        </h1>
        <h1 v-else>
            {{ $t('%SA') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <PriceInputBox v-model="fixedDiscount" error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`%SK`)" :validator="errors.validator" :min="0" :required="true" :placeholder="$t(`%JN`)" />
                
            <PermyriadInputBox v-model="percentageDiscount" error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`%2I`)" :required="true" :placeholder="$t(`%2I`)" :validator="errors.validator" />
        </div>

        <p class="style-description-small">
            {{ $t('%SB') }}
        </p>

        <hr><h2>
            {{ $t('%SC') }}
        </h2>
        <p>{{ $t('%SD') }}</p>

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
                <span>{{ $t('%Rg') }}</span>
            </button>
        </p>

        <hr><h2>
            {{ $t('%SE') }}
        </h2>
        <p>{{ $t('%SF') }}</p>

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
                <span>{{ $t('%SG') }}</span>
            </button>
        </p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="applyMultipleTimes" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%SH') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%SI') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%SJ') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { PrivateWebshop } from '@stamhoofd/structures';
import { Discount, DiscountRequirement, GeneralDiscount, ProductDiscountSettings, ProductSelector, ProductsSelector } from '@stamhoofd/structures';

import PermyriadInputBox from '@stamhoofd/components/inputs/PermyriadInputBox.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';
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
        product: ProductsSelector.create({
            products: [
                ProductSelector.create({
                    productId: props.webshop.products[0].id,
                }),
            ],
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
        product: ProductsSelector.create({
            products: [
                ProductSelector.create({
                    productId: props.webshop.products[0].id,
                }),
            ],
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
