<template>
    <SaveView :title="isNew ? 'Productkorting toevoegen' : 'Productkorting bewerken'" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            Productkorting toevoegen
        </h1>
        <h1 v-else>
            Productkorting bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <ProductSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector" />

        <hr>
        <h2>Korting</h2>
        <p v-if="discounts.length > 1">
            De kortingen worden toegepast van hoog naar lage prijs. Dus het eerste stuk is het artikel met de hoogste prijs (als er prijs verschillen zijn binnenin hetzelfde artikel door bijvoorbeeld keuzemenu's). Als de korting per stuk groter is dan de prijs van een stuk, is het stuk gratis en wordt de korting niet overgedragen.
        </p>

        <div v-for="(d, index) in discounts" :key="d.id">
            <STInputBox :title="discounts.length === 1 ? 'Korting' : 'Korting op '+(index+1)+'e stuk' + ((repeatBehaviour === 'RepeatLast' && index === discounts.length - 1) ? ' en verder' : '')" :error-box="errors.errorBox" class="max">
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
                                Percentage
                            </option>
                            <option value="discountPerPiece">
                                Bedrag
                            </option>
                        </Dropdown>
                    </div>
                </div>
            </STInputBox>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span v-if="discounts.length === 1">Andere korting op tweede stuk</span>
                <span v-else>Toevoegen</span>
            </button>
        </p>

        <!--<STInputBox title="Kortingpercentage" error-fields="percentageDiscount" :error-box="errors.errorBox" class="max">
            <PermyriadInput
                v-model="percentageDiscount"
                :required="true"
            />
        </STInputBox>-->

        <hr>
        <h2>Herhalen</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="Once" />
                </template>
                <h3 class="style-title-list">
                    Niet herhalen
                </h3>
                <p class="style-description">
                    De korting wordt maar één keer toegepast.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatLast" />
                </template>
                <h3 v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" class="style-title-list">
                    Laatste korting herhalen
                </h3>
                <h3 v-else>
                    Herhalen
                </h3>
                <p class="style-description">
                    De laatste korting uit de lijst wordt toegepast als er nog meer stuks zijn.
                </p>
            </STListItem>

            <STListItem v-if="discounts.length > 1 || repeatBehaviour === 'RepeatPattern'" :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="repeatBehaviour" value="RepeatPattern" />
                </template>
                <h3 class="style-title-list">
                    Patroon herhalen
                </h3>
                <p class="style-description">
                    Als er meer stuks zijn wordt de eerste korting terug toegepast, daarna de tweede...
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Zichtbaarheid (optioneel)</h2>
        <p>Als deze korting wordt toegepast op een item in een winkelmandje kan je bij dat item een label tonen (bv. 'BLACK FRIDAY'). Hou dit label kort, bij voorkeur 1 woord.</p>

        <STInputBox title="Label" error-fields="cartLabel" :error-box="errors.errorBox">
            <input
                v-model="cartLabel"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete="off"
            >
        </STInputBox>

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
