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
                    {{ $t('261191bf-7565-4444-9e4c-7fffe5f7b919') }}
                </div>
            </div>
        </STInputBox>

        <div v-for="{product, productSelector} of products" :key="product.id">
            <STInputBox v-if="product && product.prices.length > 1" :title="products.length === 1 ? 'Prijskeuzes' : ('Prijskeuzes ' + product.name)" error-fields="productPriceIds" :error-box="errorBox" class="max">
                <STList>
                    <STListItem v-for="price of product.prices" :key="price.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="isPriceSelected(productSelector, price)" @update:model-value="setPriceSelected({product, productSelector}, price, $event)" />
                        </template>

                        <h2 class="style-title-list">
                            {{ price.name || $t('Naamloos') }}
                        </h2>
                    </STListItem>
                </STList>
            </STInputBox>

            <STInputBox v-for="optionMenu of product.optionMenus" :key="optionMenu.id" :title="(optionMenu.name || 'Naamloos') + (products.length > 1 ? ' ('+product.name+')' : '')" :error-fields="'optionMenu.'+optionMenu.id" :error-box="errorBox" class="max">
                <STList>
                    <STListItem v-for="option of optionMenu.options" :key="option.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="isOptionSelected(productSelector, optionMenu, option)" @update:model-value="setOptionSelected(productSelector, optionMenu, option, $event)" />
                        </template>

                        <h2 class="style-title-list">
                            {{ option.name || $t('Naamloos') }}
                        </h2>

                        <template #right>
                            <button v-if="optionMenu.multipleChoice" class="button text" type="button" @click.stop.prevent="showRequirementMenu(productSelector, optionMenu, option, $event)">
                                <span>{{ getRequirementName(getOptionRequirement(productSelector, optionMenu, option)) }}</span>
                                <span class="icon arrow-down-small" />
                            </button>
                        </template>
                    </STListItem>
                </STList>
            </STInputBox>
        </div>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Checkbox, ContextMenu, ContextMenuItem, ErrorBox, ImageComponent, STInputBox, STList, STListItem, Validator } from '@stamhoofd/components';
import { Option, OptionMenu, OptionSelectionRequirementHelper, ProductSelector } from '@stamhoofd/structures';
import { OptionSelectionRequirement } from '@stamhoofd/structures';
import { PrivateWebshop, Product, ProductPrice, ProductsSelector } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import ChooseProductsView from './ChooseProductsView.vue';

@Component({
    components: {
        STListItem,
        STList,
        ImageComponent,
        Checkbox,
        STInputBox,
    },
})
export default class ProductsSelectorBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    webshop: PrivateWebshop;

    @Prop({ required: true })
    productSelector: ProductsSelector;

    @Prop({ default: null })
    validator: Validator | null;

    errorBox: ErrorBox | null = null;

    addPatch(patch: AutoEncoderPatchType<ProductsSelector>) {
        this.$emit('patch', patch);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate();
            });
        }
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    changeProduct() {
        this.present({
            components: [
                new ComponentWithProperties(ChooseProductsView, {
                    webshop: this.webshop,
                    selectedProductIds: this.productSelector.products.map(p => p.productId),
                    saveHandler: (ids: string[]) => {
                        const productSelectors = this.productSelector.products.filter(p => ids.includes(p.productId));
                        // Add any missing
                        for (const id of ids) {
                            if (!productSelectors.find(p => p.productId === id)) {
                                productSelectors.push(ProductSelector.create({
                                    productId: id,
                                    optionIds: new Map(),
                                }));
                            }
                        }
                        const patch = ProductsSelector.patch({
                            products: productSelectors,
                        });
                        this.addPatch(patch);
                    },
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    async validate() {
        if (this.productSelector.products.length === 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Kies een artikel',
                field: 'productId',
            }));
            return false;
        }

        return true;
    }

    get products() {
        return this.productSelector.products.flatMap((ps) => {
            const product = this.webshop.products.find(p => p.id === ps.productId);
            if (product) {
                return [{ product, productSelector: ps }];
            }
            return [];
        });
    }

    isPriceSelected(productSelector: ProductSelector, price: ProductPrice) {
        return productSelector.productPriceIds.includes(price.id) || productSelector.productPriceIds.length === 0;
    }

    setPriceSelected({ product, productSelector }: { product: Product; productSelector: ProductSelector }, price: ProductPrice, selected: boolean) {
        let productPriceIds = productSelector.productPriceIds.filter(i => i !== price.id);
        if (productPriceIds.length === 0 && product) {
            productPriceIds = product!.prices.map(p => p.id).filter(i => i !== price.id);
        }

        if (selected) {
            productPriceIds.push(price.id);
        }

        if (productPriceIds.length === product.prices.length) {
            productPriceIds = [];
        }

        this.addPatch(ProductsSelector.patch({
            products: this.productSelector.products.map((p) => {
                if (p.productId === productSelector.productId) {
                    return ProductSelector.create({
                        ...p,
                        productPriceIds: productPriceIds,
                    });
                }
                return p;
            }),
        }));
    }

    getOptionRequirement(productSelector: ProductSelector, menu: OptionMenu, option: Option): OptionSelectionRequirement {
        return productSelector.getOptionRequirement(menu, option);
    }

    setOptionRequirement(productSelector: ProductSelector, menu: OptionMenu, option: Option, requirement: OptionSelectionRequirement) {
        const map = new Map(productSelector.optionIds);

        map.set(option.id, requirement);

        this.addPatch(ProductsSelector.patch({
            products: this.productSelector.products.map((p) => {
                if (p.productId === productSelector.productId) {
                    return ProductSelector.create({
                        ...p,
                        optionIds: map,
                    });
                }
                return p;
            }),
        }));
    }

    isOptionSelected(productSelector: ProductSelector, menu: OptionMenu, option: Option): boolean {
        return productSelector.getOptionRequirement(menu, option) !== OptionSelectionRequirement.Excluded;
    }

    setOptionSelected(productSelector: ProductSelector, menu: OptionMenu, option: Option, selected: boolean) {
        const currentSelected = this.isOptionSelected(productSelector, menu, option);

        if (currentSelected === selected) {
            return;
        }

        const map = new Map(productSelector.optionIds);

        if (selected) {
            map.set(option.id, OptionSelectionRequirement.Optional);
        }
        else {
            map.set(option.id, OptionSelectionRequirement.Excluded);
        }

        this.addPatch(ProductsSelector.patch({
            products: this.productSelector.products.map((p) => {
                if (p.productId === productSelector.productId) {
                    return ProductSelector.create({
                        ...p,
                        optionIds: map,
                    });
                }
                return p;
            }),
        }));
    }

    getRequirementName(requirement: OptionSelectionRequirement) {
        return OptionSelectionRequirementHelper.getName(requirement);
    }

    showRequirementMenu(productSelector: ProductSelector, menu: OptionMenu, option: Option, event) {
        const value = this.getOptionRequirement(productSelector, menu, option);
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
                        this.setOptionRequirement(productSelector, menu, option, v);
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
