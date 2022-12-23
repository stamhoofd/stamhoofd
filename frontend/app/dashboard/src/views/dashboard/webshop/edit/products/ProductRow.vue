<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editProduct()" @contextmenu.prevent="showContextMenu">
        <template slot="left">
            <img v-if="imageSrc" :src="imageSrc" class="product-row-image">
        </template>
        
        <h2 class="style-title-list">
            {{ product.name }}
        </h2>
        <p v-if="product.isEnabledTextLong" class="style-description">
            {{ product.isEnabledTextLong }}
        </p>
        <p v-if="product.stockText" class="style-description">
            {{ product.stockText }}
        </p>
        <p>
            <span class="style-tag">
                {{ price | price }}
            </span>
        </p>

        <template slot="right">
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, STListItem } from "@stamhoofd/components";
import { PrivateWebshop, Product } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from './EditProductView.vue';

@Component({
    components: {
        STListItem
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
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

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }

    get price() {
        return this.product.prices[0].price
    }

    showContextMenu(event) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Verplaats omhoog",
                    icon: "arrow-up",
                    action: () => {
                        this.moveUp()
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: "Verplaats omlaag",
                    icon: "arrow-down",
                    action: () => {
                        this.moveDown()
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
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

    @media (max-width: 550px) {
        width: 50px;
        height: 50px;
    }
}
</style>
