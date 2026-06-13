<template>
    <div class="product-selector-box">
        <STInputBox title="Artikel(s)" error-fields="productId" :error-box="errorBox" class="max">
            <div class="style-input-box" @click="changeProduct">
                <STList v-if="products.length > 0">
                    <STListItem v-for="{product} of products" :key="product.id" :selectable="true" element-name="label">
                        <template #left>
                            <div v-if="product.images[0]" class="product-selector-image-preview">
                                <ImageComponent :image="product.images[0]" :auto-height="true" />
                            </div>
                        </template>

                        <h2 class="style-title-list">
                            {{ product.name }}
                        </h2>

                        <template #right>
                            <span class="icon arrow-down-small gray" />
                        </template>
                    </STListItem>
                </STList>
                <div v-else>
                    {{ $t('%Sb') }}
                </div>
            </div>
        </STInputBox>

        <div v-for="{product, productSelector: selector} of products" :key="product.id">
            <STInputBox v-if="product && product.prices.length > 1" :title="products.length === 1 ? 'Prijskeuzes' : ('Prijskeuzes ' + product.name)" error-fields="productPriceIds" :error-box="errorBox" class="max">
                <STList>
                    <STListItem v-for="price of product.prices" :key="price.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="isPriceSelected(selector, price)" @update:model-value="setPriceSelected({product, productSelector: selector}, price, $event)" />
                        </template>

                        <h2 class="style-title-list">
                            {{ price.name || $t('%CL') }}
                        </h2>
                    </STListItem>
                </STList>
            </STInputBox>

            <STInputBox v-for="optionMenu of product.optionMenus" :key="optionMenu.id" :title="(optionMenu.name || 'Naamloos') + (products.length > 1 ? ' ('+product.name+')' : '')" :error-fields="'optionMenu.'+optionMenu.id" :error-box="errorBox" class="max">
                <STList>
                    <STListItem v-for="option of optionMenu.options" :key="option.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="isOptionSelected(selector, optionMenu, option)" @update:model-value="setOptionSelected(selector, optionMenu, option, $event)" />
                        </template>

                        <h2 class="style-title-list">
                            {{ option.name || $t('%CL') }}
                        </h2>

                        <template #right>
                            <button v-if="optionMenu.multipleChoice" class="button text" type="button" @click.stop.prevent="showRequirementMenu(selector, optionMenu, option, $event)">
                                <span>{{ getRequirementName(getOptionRequirement(selector, optionMenu, option)) }}</span>
                                <span class="icon arrow-down-small" />
                            </button>
                        </template>
                    </STListItem>
                </STList>
            </STInputBox>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useValidation } from '@stamhoofd/components/errors/useValidation.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import type { Option, OptionMenu } from '@stamhoofd/structures';
import { OptionSelectionRequirementHelper, ProductSelector } from '@stamhoofd/structures';
import { OptionSelectionRequirement } from '@stamhoofd/structures';
import type { PrivateWebshop, Product, ProductPrice } from '@stamhoofd/structures';
import { ProductsSelector } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import ChooseProductsView from './ChooseProductsView.vue';

const props = withDefaults(defineProps<{
    webshop: PrivateWebshop;
    productSelector: ProductsSelector;
    validator?: Validator | null;
}>(), {
    validator: null,
});
const emit = defineEmits<{
    patch: [patch: AutoEncoderPatchType<ProductsSelector>];
}>();
const present = usePresent();
const errorBox = ref<ErrorBox | null>(null);

if (props.validator) {
    useValidation(props.validator, validate);
}

function addPatch(patch: AutoEncoderPatchType<ProductsSelector>) {
    emit('patch', patch);
}

async function changeProduct() {
    await present({
        components: [
            new ComponentWithProperties(ChooseProductsView, {
                webshop: props.webshop,
                selectedProductIds: props.productSelector.products.map(p => p.productId),
                saveHandler: (ids: string[]) => {
                    const productSelectors = props.productSelector.products.filter(p => ids.includes(p.productId));
                    for (const id of ids) {
                        if (!productSelectors.find(p => p.productId === id)) {
                            productSelectors.push(ProductSelector.create({
                                productId: id,
                                optionIds: new Map(),
                            }));
                        }
                    }
                    addPatch(ProductsSelector.patch({
                        products: productSelectors,
                    }));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

async function validate() {
    if (props.productSelector.products.length === 0) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'Kies een artikel',
            field: 'productId',
        }));
        return false;
    }
    errorBox.value = null;
    return true;
}

const products = computed(() => props.productSelector.products.flatMap((productSelector) => {
    const product = props.webshop.products.find(p => p.id === productSelector.productId);
    return product ? [{ product, productSelector }] : [];
}));

function isPriceSelected(productSelector: ProductSelector, price: ProductPrice) {
    return productSelector.productPriceIds.includes(price.id) || productSelector.productPriceIds.length === 0;
}

function setPriceSelected({ product, productSelector }: { product: Product; productSelector: ProductSelector }, price: ProductPrice, selected: boolean) {
    let productPriceIds = productSelector.productPriceIds.filter(i => i !== price.id);
    if (productPriceIds.length === 0) {
        productPriceIds = product.prices.map(p => p.id).filter(i => i !== price.id);
    }

    if (selected) {
        productPriceIds.push(price.id);
    }

    if (productPriceIds.length === product.prices.length) {
        productPriceIds = [];
    }

    addPatch(ProductsSelector.patch({
        products: props.productSelector.products.map(p => p.productId === productSelector.productId
            ? ProductSelector.create({ ...p, productPriceIds })
            : p),
    }));
}

const getOptionRequirement = (productSelector: ProductSelector, menu: OptionMenu, option: Option) => productSelector.getOptionRequirement(menu, option);

function setOptionRequirement(productSelector: ProductSelector, menu: OptionMenu, option: Option, requirement: OptionSelectionRequirement) {
    const map = new Map(productSelector.optionIds);
    map.set(option.id, requirement);

    addPatch(ProductsSelector.patch({
        products: props.productSelector.products.map(p => p.productId === productSelector.productId
            ? ProductSelector.create({ ...p, optionIds: map })
            : p),
    }));
}

const isOptionSelected = (productSelector: ProductSelector, menu: OptionMenu, option: Option) => getOptionRequirement(productSelector, menu, option) !== OptionSelectionRequirement.Excluded;

function setOptionSelected(productSelector: ProductSelector, menu: OptionMenu, option: Option, selected: boolean) {
    if (isOptionSelected(productSelector, menu, option) === selected) {
        return;
    }

    const map = new Map(productSelector.optionIds);
    if (selected) {
        map.set(option.id, OptionSelectionRequirement.Optional);
    } else {
        map.set(option.id, OptionSelectionRequirement.Excluded);
    }

    addPatch(ProductsSelector.patch({
        products: props.productSelector.products.map(p => p.productId === productSelector.productId
            ? ProductSelector.create({ ...p, optionIds: map })
            : p),
    }));
}

const getRequirementName = OptionSelectionRequirementHelper.getName.bind(OptionSelectionRequirementHelper);

function showRequirementMenu(productSelector: ProductSelector, menu: OptionMenu, option: Option, event: MouseEvent) {
    const value = getOptionRequirement(productSelector, menu, option);
    const values = menu.multipleChoice
        ? [OptionSelectionRequirement.Optional, OptionSelectionRequirement.Required, OptionSelectionRequirement.Excluded]
        : [OptionSelectionRequirement.Optional, OptionSelectionRequirement.Excluded];

    new ContextMenu([values.map(v => new ContextMenuItem({
        name: OptionSelectionRequirementHelper.getName(v),
        selected: v === value,
        action: () => {
            setOptionRequirement(productSelector, menu, option, v);
            return true;
        },
    }))]).show({
        button: event.currentTarget as HTMLElement,
        xPlacement: 'left',
        yPlacement: 'bottom',
    }).catch(console.error);
}
</script>

<style lang="scss">
.product-selector-image-preview .image-component {
    width: 50px;

    img {
        border-radius: 5px;
    }
}

.product-selector-box {
    .style-input-box {
        padding-left: 15px;
        padding-right: 15px;
        --st-horizontal-padding: 15px;
        overflow: hidden;
    }
}
</style>
