<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editPrice()" @contextmenu.prevent="showContextMenu">
        {{ productPrice.name || 'Naamloos' }}
        <template slot="right">
            <span><template v-if="productPrice.discountPrice">
                      {{ productPrice.discountPrice | price }} /
                  </template>
                {{ productPrice.price | price }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
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
    },
    directives: {
        LongPress: LongPressDirective
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

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
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