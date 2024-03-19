<template>
    <div>
        <STInputBox title="Artikel" error-fields="productId" :error-box="errorBox" class="max">
            <div class="style-input-box input-icon-container right icon arrow-down-small gray" @click="changeProduct">
                <STList v-if="product">
                    <STListItem>
                        <div slot="left" v-if="product.images[0]" class="product-selector-image-preview">
                            <ImageComponent :image="product.images[0]" />
                        </div>
                        
                        <h2 class="style-title-list">
                            {{ product.name }}
                        </h2>
                    </STListItem>
                </STList>
                <div v-else>
                    Onbekend artikel
                </div>
            </div>
        </STInputBox>

        <STInputBox title="Prijskeuzes" error-fields="productPriceIds" :error-box="errorBox" class="max" v-if="product && product.prices.length > 1">
            <STList>
                <STListItem v-for="price of product.prices" :key="price.id" :selectable="true" element-name="label">
                     <Checkbox slot="left" :checked="isPriceSelected(price)" @change="setPriceSelected(price, $event)" />

                    <h2 class="style-title-list">
                        {{ price.name || 'Naamloos' }}
                    </h2>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox :title="optionMenu.name || 'Naamloos'" :error-fields="'optionMenu.'+optionMenu.id" :error-box="errorBox" class="max" v-for="optionMenu of product.optionMenus" :key="optionMenu.id">
            <STList>
                <STListItem v-for="option of optionMenu.options" :key="option.id" :selectable="true" element-name="label">
                     <Checkbox slot="left" :checked="isOptionSelected(option)" @change="setOptionSelected(option, $event)" />

                    <h2 class="style-title-list">
                        {{ option.name || 'Naamloos' }}
                    </h2>

                     <button class="button text" type="button" slot="right" v-if="optionMenu.multipleChoice && isOptionSelected(option)">
                        <span>Optioneel</span>
                        <span class="icon arrow-down-small" />
                    </button>
                </STListItem>
            </STList>
        </STInputBox>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ErrorBox, ImageComponent, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { Option } from "@stamhoofd/structures";
import { PrivateWebshop, Product, ProductPrice, ProductSelector } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import ChooseProductView from "./ChooseProductView.vue";


@Component({
    components: {
        STListItem,
        STList,
        ImageComponent,
        Checkbox,
        STInputBox
    }
})
export default class ProductSelectorBox extends Mixins(NavigationMixin) {
    @Prop({required: true})
        webshop: PrivateWebshop

    @Prop({required: true})
        productSelector: ProductSelector

    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null

    addPatch(patch: AutoEncoderPatchType<ProductSelector>) {
        this.$emit('patch', patch);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
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
                            excludeOptionIds: [] as any,
                            productPriceIds: [] as any
                        }))
                    }
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    async validate() {
        if (!this.product) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": 'Kies een artikel',
                "field": "productId"
            }))
            return false
        }

        for (const menu of this.product.optionMenus) {
            if (!menu.multipleChoice) {
                const ids = menu.options.filter(o => this.productSelector.excludeOptionIds.includes(o.id))
                if (ids.length === menu.options.length) {
                    this.errorBox = new ErrorBox(new SimpleError({
                        "code": "invalid_field",
                        "message": 'Kies minstens één optie voor ' + menu.name,
                        "field": "optionMenu."+menu.id
                    }))
                    return false;
                }
            }
        }

        return true;
    }

    get product() {
        return this.webshop.products.find(p => p.id === this.productSelector.productId)
    }

    isPriceSelected(price: ProductPrice) {
        return this.productSelector.productPriceIds.includes(price.id) || this.productSelector.productPriceIds.length === 0
    }

    setPriceSelected(price: ProductPrice, selected: boolean) {
        let productPriceIds = this.productSelector.productPriceIds.filter(i => i !== price.id)
        if (productPriceIds.length === 0 && this.product) {
            productPriceIds = this.product!.prices.map(p => p.id).filter(i => i !== price.id)
        }

        if (selected) {
            productPriceIds.push(price.id)
        }

        if (productPriceIds.length === this.product?.prices.length) {
            productPriceIds = []
        }

        this.addPatch(ProductSelector.patch({
            productPriceIds: productPriceIds as any
        }))
    }

    isOptionSelected(option: Option) {
        return !this.productSelector.excludeOptionIds.includes(option.id)
    }

    setOptionSelected(option: Option, selected: boolean) {
        const excludeOptionIds = this.productSelector.excludeOptionIds.filter(i => i !== option.id)
        if (!selected) {
            excludeOptionIds.push(option.id)
        }
        this.addPatch(ProductSelector.patch({
            excludeOptionIds: excludeOptionIds as any
        }))
    }
}
</script>


<style lang="scss">
.product-selector-image-preview .image-component {
    width: 50px;
    height: 50px;
}
</style>
