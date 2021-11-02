<template>
    <STListItem :selectable="true" @click="editProduct()">
        <template slot="left">
            <img v-if="imageSrc" :src="imageSrc" class="product-row-image">
        </template>
        
        <h2 class="style-title-list">
            {{ product.name }}
        </h2>
        <p v-if="!product.enabled" class="style-description">
            Tijdelijk niet beschikbaar
        </p>
        <p v-else-if="product.isSoldOut" class="style-description">
            Uitverkocht
        </p>

        <template slot="right">
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
import { PrivateWebshop, Product } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from './EditProductView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class ProductRow extends Mixins(NavigationMixin) {
    @Prop({})
    product: Product

    @Prop({})
    webshop: PrivateWebshop

    get imageSrc() {
        return this.product.images[0]?.getPathForSize(80, 80)
    }

    editProduct() {
        this.present(new ComponentWithProperties(EditProductView, { product: this.product, webshop: this.webshop, isNew: false, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            this.$emit("patch", patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
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
@use "@stamhoofd/scss/base/variables.scss" as *;

.product-row-image {
    width: 80px;
    height: 80px;
    margin: -5px 0;
    border-radius: $border-radius;
}
</style>
