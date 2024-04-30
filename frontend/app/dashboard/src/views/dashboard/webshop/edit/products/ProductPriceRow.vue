<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editPrice()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ productPrice.name || 'Naamloos' }}
        </h3>
        <p v-if="productPrice.hidden" class="style-description-small">
            Verborgen
        </p>
        <p v-if="productPrice.isSoldOut" class="style-description-small">
            Uitverkocht
        </p>
        <p v-else-if="productPrice.stock" class="style-description-small">
            Nog {{ pluralText(productPrice.remainingStock, 'stuk', 'stuks') }} beschikbaar
        </p>

        <template #right>
            <span><template v-if="productPrice.discountPrice">
                      {{ formatPrice(productPrice.discountPrice) }} /
                  </template>
                {{ formatPrice(productPrice.price) }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { Product, ProductPrice } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

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
        }}).setDisplayStyle("popup"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
    
    async delete() {
        if (!(await CenteredMessage.confirm('Deze prijs verwijderen?', 'Verwijderen'))) {
            return
        }
        const p = Product.patch({ id: this.product.id })
        p.prices.addDelete(this.productPrice.id)
        this.$emit("patch", p)
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
            ],
            [
                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    action: () => {
                        this.delete().catch(console.error)
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>