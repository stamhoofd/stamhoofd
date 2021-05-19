<template>
    <STListItem :selectable="true" class="right-description right-stack no-margin" @click="editPrice()">
        {{ productPrice.name }}
        <template slot="right">
            {{ productPrice.price | price }}
            <button class="button icon arrow-up gray" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { Product, ProductPrice } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductPriceView from './EditProductPriceView.vue';

@Component({
    components: {
        STListItem
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class ProductPriceRow extends Mixins(NavigationMixin) {
    @Prop({})
    productPrice: ProductPrice

    @Prop({})
    product: Product

    editPrice() {
        this.present(new ComponentWithProperties(EditProductPriceView, { product: this.product, productPrice: this.productPrice, isNew: false, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            this.$emit("patch", patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
