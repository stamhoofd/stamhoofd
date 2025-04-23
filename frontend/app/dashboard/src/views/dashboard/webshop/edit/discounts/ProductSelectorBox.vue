<template>
    <div class="product-selector-box">
        <STInputBox error-fields="productId" :error-box="errors.errorBox" class="max" :title="$t(`Artikel`)">
            <div class="style-input-box" @click="changeProduct">
                <STList v-if="product">
                    <STListItem :selectable="true">
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
                    {{ $t('Onbekend artikel') }}
                </div>
            </div>
        </STInputBox>

        <STInputBox v-if="product && product.prices.length > 1" error-fields="productPriceIds" :error-box="errors.errorBox" class="max" :title="$t(`Prijskeuzes`)">
            <STList>
                <STListItem v-for="price of product.prices" :key="price.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="isPriceSelected(price)" @update:model-value="setPriceSelected(price, $event)" />
                    </template>

                    <h2 class="style-title-list">
                        {{ price.name || 'Naamloos' }}
                    </h2>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-for="optionMenu of product.optionMenus" :key="optionMenu.id" :title="optionMenu.name || $t(`Naamloos`)" :error-fields="'optionMenu.'+optionMenu.id" :error-box="errors.errorBox" class="max">
            <STList>
                <STListItem v-for="option of optionMenu.options" :key="option.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="isOptionSelected(optionMenu, option)" @update:model-value="setOptionSelected(optionMenu, option, $event)" />
                    </template>

                    <h2 class="style-title-list">
                        {{ option.name || 'Naamloos' }}
                    </h2>

                    <template #right>
                        <button v-if="optionMenu.multipleChoice" class="button text" type="button" @click.stop.prevent="showRequirementMenu(optionMenu, option, $event)">
                            <span>{{ getRequirementName(getOptionRequirement(optionMenu, option)) }}</span>
                            <span class="icon arrow-down-small" />
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, ContextMenu, ContextMenuItem, ErrorBox, ImageComponent, STInputBox, STList, STListItem, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { Option, OptionMenu, OptionSelectionRequirement, OptionSelectionRequirementHelper, PrivateWebshop, Product, ProductPrice, ProductSelector } from '@stamhoofd/structures';
import { computed } from 'vue';
import ChooseProductView from './ChooseProductView.vue';

const props = withDefaults(defineProps<{
    webshop: PrivateWebshop;
    productSelector: ProductSelector;
    validator: Validator | null;
}>(), {
    validator: null,
});

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<ProductSelector>): void }>();

const present = usePresent();
const errors = useErrors({ validator: props.validator });

useValidation(errors.validator, () => {
    return validate();
});

function addPatch(patch: AutoEncoderPatchType<ProductSelector>) {
    emits('patch', patch);
}

function changeProduct() {
    present({
        components: [
            new ComponentWithProperties(ChooseProductView, {
                webshop: props.webshop,
                selectedProductId: props.productSelector.productId,
                saveHandler: (product: Product) => {
                    addPatch(ProductSelector.patch({
                        productId: product.id,
                        optionIds: new PatchMap(),
                    }));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

async function validate() {
    if (!product.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'Kies een artikel',
            field: 'productId',
        }));
        return false;
    }

    return true;
}

const product = computed(() => props.webshop.products.find(p => p.id === props.productSelector.productId)!);

function isPriceSelected(price: ProductPrice) {
    return props.productSelector.productPriceIds.includes(price.id) || props.productSelector.productPriceIds.length === 0;
}

function setPriceSelected(price: ProductPrice, selected: boolean) {
    let productPriceIds = props.productSelector.productPriceIds.filter(i => i !== price.id);
    if (productPriceIds.length === 0 && product.value) {
        productPriceIds = product.value!.prices.map(p => p.id).filter(i => i !== price.id);
    }

    if (selected) {
        productPriceIds.push(price.id);
    }

    if (productPriceIds.length === product.value?.prices.length) {
        productPriceIds = [];
    }

    addPatch(ProductSelector.patch({
        productPriceIds: productPriceIds as any,
    }));
}

function getOptionRequirement(menu: OptionMenu, option: Option): OptionSelectionRequirement {
    return props.productSelector.getOptionRequirement(menu, option);
}

function setOptionRequirement(_menu: OptionMenu, option: Option, requirement: OptionSelectionRequirement) {
    const map = new PatchMap(props.productSelector.optionIds);

    map.set(option.id, requirement);

    addPatch(ProductSelector.patch({
        optionIds: map,
    }));
}

function isOptionSelected(menu: OptionMenu, option: Option): boolean {
    return props.productSelector.getOptionRequirement(menu, option) !== OptionSelectionRequirement.Excluded;
}

function setOptionSelected(menu: OptionMenu, option: Option, selected: boolean) {
    const currentSelected = isOptionSelected(menu, option);

    if (currentSelected === selected) {
        return;
    }

    const map = new PatchMap(props.productSelector.optionIds);

    if (selected) {
        map.set(option.id, OptionSelectionRequirement.Optional);
    }
    else {
        map.set(option.id, OptionSelectionRequirement.Excluded);
    }

    addPatch(ProductSelector.patch({
        optionIds: map,
    }));
}

function getRequirementName(requirement: OptionSelectionRequirement) {
    return OptionSelectionRequirementHelper.getName(requirement);
}

function showRequirementMenu(menu: OptionMenu, option: Option, event: MouseEvent | TouchEvent) {
    const value = getOptionRequirement(menu, option);
    let values = [OptionSelectionRequirement.Optional, OptionSelectionRequirement.Required, OptionSelectionRequirement.Excluded];

    if (!menu.multipleChoice) {
        values = [OptionSelectionRequirement.Optional, OptionSelectionRequirement.Excluded];
    }

    const c = new ContextMenu([
        values.map((v) => {
            return new ContextMenuItem({
                name: OptionSelectionRequirementHelper.getName(v),
                selected: v === value,
                action: () => {
                    setOptionRequirement(menu, option, v);
                    return true;
                },
            });
        }),
    ]);

    c.show({
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
