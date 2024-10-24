<template>
    <SaveView :title="isNew ? 'Korting toevoegen' : 'Korting bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Korting toevoegen
        </h1>
        <h1 v-else>
            Korting bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Vast bedrag" error-fields="administrationFee.fixed" :error-box="errors.errorBox">
                <PriceInput v-model="fixedDiscount" :min="0" placeholder="Vaste kost" :required="true" />
            </STInputBox>

            <STInputBox title="Percentage" error-fields="administrationFee.fixed" :error-box="errors.errorBox">
                <PermyriadInput v-model="percentageDiscount" placeholder="Percentage" :required="true" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            Deze kortingen worden op de volledige bestelling toegepast.
        </p>

        <hr>
        <h2>
            Korting op specifieke artikels
        </h2>
        <p>Je kan een procentuele korting geven op bepaalde artikels, je kan één artikel gratis maken, je kan een korting per stuk geven op de eerste x aantal stuks (of alle stuks) van een artikel...</p>

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
                <span>Artikel toevoegen</span>
            </button>
        </p>

        <hr>
        <h2>
            Artikelvoorwaarden
        </h2>
        <p>De korting wordt enkel toegepast als deze artikels met een bepaalde hoeveelheid aanwezig zijn in het winkelmandje. Hiermee kan je speciale kortingen bereiken waarbij je bijvoorbeeld korting geeft op een bepaald artikel als je eerst een ander artikel bestelt (bv. één drankkaart gratis als je 10 tickets bestelt).</p>

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
                <span>Artikelvoorwaarde toevoegen</span>
            </button>
        </p>

        <STList v-if="patchedDiscount.requirements.length">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="applyMultipleTimes" />
                </template>

                <h3 class="style-title-list">
                    Meerdere keren toepassen
                </h3>
                <p class="style-description-small">
                    Als de vereiste artikels meerdere keren aanwezig zijn, dan wordt de korting meerdere keren toegepast. Bijvoorbeeld als je korting op één artikel geeft op voorwaarde dat je eerst een ander artikel erbij bestelt.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze korting
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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
