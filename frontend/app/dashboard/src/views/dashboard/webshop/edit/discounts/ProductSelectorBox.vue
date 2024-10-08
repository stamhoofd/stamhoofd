<template>
    <div class="product-selector-box">
        <STInputBox title="Artikel" error-fields="productId" :error-box="errorBox" class="max">
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
                    Onbekend artikel
                </div>
            </div>
        </STInputBox>

        <STInputBox v-if="product && product.prices.length > 1" title="Prijskeuzes" error-fields="productPriceIds" :error-box="errorBox" class="max">
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

        <STInputBox v-for="optionMenu of product.optionMenus" :key="optionMenu.id" :title="optionMenu.name || 'Naamloos'" :error-fields="'optionMenu.'+optionMenu.id" :error-box="errorBox" class="max">
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

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Checkbox, ContextMenu, ContextMenuItem, ErrorBox, ImageComponent, STInputBox, STList, STListItem, Validator } from '@stamhoofd/components';
import { Option, OptionMenu, OptionSelectionRequirementHelper } from '@stamhoofd/structures';
import { OptionSelectionRequirement } from '@stamhoofd/structures';
import { PrivateWebshop, Product, ProductPrice, ProductSelector } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import ChooseProductView from './ChooseProductView.vue';

@Component({
    components: {
        STListItem,
        STList,
        ImageComponent,
        Checkbox,
        STInputBox,
    },
})
export default class ProductSelectorBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshop: PrivateWebshop;

    @Prop({ required: true })
    productSelector: ProductSelector;

    @Prop({ default: null })
    validator: Validator | null;

    errorBox: ErrorBox | null = null;

    addPatch(patch: AutoEncoderPatchType<ProductSelector>) {
        this.$emit('patch', patch);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate();
            });
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    changeProduct() {
        this.present({
            components: [
                new ComponentWithProperties(ChooseProductView, {
                    webshop: this.webshop,
                    selectedProductId: this.productSelector.productId,
                    saveHandler: (product: Product) => {
                        this.addPatch(ProductSelector.patch({
                            productId: product.id,
                            optionIds: new Map(),
                        }));
                    },
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    async validate() {
        if (!this.product) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Kies een artikel',
                field: 'productId',
            }));
            return false;
        }

        return true;
    }

    get product() {
        return this.webshop.products.find(p => p.id === this.productSelector.productId);
    }

    isPriceSelected(price: ProductPrice) {
        return this.productSelector.productPriceIds.includes(price.id) || this.productSelector.productPriceIds.length === 0;
    }

    setPriceSelected(price: ProductPrice, selected: boolean) {
        let productPriceIds = this.productSelector.productPriceIds.filter(i => i !== price.id);
        if (productPriceIds.length === 0 && this.product) {
            productPriceIds = this.product!.prices.map(p => p.id).filter(i => i !== price.id);
        }

        if (selected) {
            productPriceIds.push(price.id);
        }

        if (productPriceIds.length === this.product?.prices.length) {
            productPriceIds = [];
        }

        this.addPatch(ProductSelector.patch({
            productPriceIds: productPriceIds as any,
        }));
    }

    getOptionRequirement(menu: OptionMenu, option: Option): OptionSelectionRequirement {
        return this.productSelector.getOptionRequirement(menu, option);
    }

    setOptionRequirement(menu: OptionMenu, option: Option, requirement: OptionSelectionRequirement) {
        const map = new Map(this.productSelector.optionIds);

        map.set(option.id, requirement);

        this.addPatch(ProductSelector.patch({
            optionIds: map,
        }));
    }

    isOptionSelected(menu: OptionMenu, option: Option): boolean {
        return this.productSelector.getOptionRequirement(menu, option) !== OptionSelectionRequirement.Excluded;
    }

    setOptionSelected(menu: OptionMenu, option: Option, selected: boolean) {
        const currentSelected = this.isOptionSelected(menu, option);

        if (currentSelected === selected) {
            return;
        }

        const map = new Map(this.productSelector.optionIds);

        if (selected) {
            map.set(option.id, OptionSelectionRequirement.Optional);
        }
        else {
            map.set(option.id, OptionSelectionRequirement.Excluded);
        }

        this.addPatch(ProductSelector.patch({
            optionIds: map,
        }));
    }

    getRequirementName(requirement: OptionSelectionRequirement) {
        return OptionSelectionRequirementHelper.getName(requirement);
    }

    showRequirementMenu(menu: OptionMenu, option: Option, event) {
        const value = this.getOptionRequirement(menu, option);
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
                        this.setOptionRequirement(menu, option, v);
                        return true;
                    },
                });
            }),
        ]);

        c.show({
            button: event.currentTarget,
            xPlacement: 'left',
            yPlacement: 'bottom',
        }).catch(console.error);
    }
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
