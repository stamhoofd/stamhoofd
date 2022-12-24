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
import { ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { Category } from '@stamhoofd/structures';
import { PrivateWebshop, Product } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from './EditProductView.vue';

@Component({
    components: {
        STListItem
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    },
    directives: {
        LongPress: LongPressDirective,
    }
})
export default class ProductRow extends Mixins(NavigationMixin) {
    @Prop({required: true})
        product: Product

    @Prop({required: false, default: null})
        category: Category | null

    @Prop({required: true})
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

    duplicate() {
        const duplicatedProduct = this.product.clone()
        duplicatedProduct.id = uuidv4()

        // while name is in use
        // Remove and get number at end of duplicated product, default to 1
        let counter = 0;
        while (this.webshop.products.find(p => p.name == duplicatedProduct.name) && counter < 100) {
            const endNumber = parseInt(duplicatedProduct.name.match(/\d+$/)?.[0] ?? "1")
            duplicatedProduct.name = duplicatedProduct.name.replace(/\d+$/, "") + (endNumber + 1)
            counter++
        }

        const webshopPatch = PrivateWebshop.patch({
            id: this.webshop.id,
        })
        webshopPatch.products.addPut(duplicatedProduct, this.product.id)

        if (this.category) {
            const categoryPatch = Category.patch({
                id: this.category.id
            })
            categoryPatch.productIds.addPut(duplicatedProduct.id, this.product.id)
            webshopPatch.categories.addPatch(categoryPatch)
        }
        this.$emit("patch", webshopPatch)
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
            ],
            [
                new ContextMenuItem({
                    name: "Dupliceren",
                    icon: "copy",
                    action: () => {
                        this.duplicate()
                        return true;
                    }
                }),
                ...(this.category && this.webshop.categories.length >= 2 ? [
                    new ContextMenuItem({
                        name: "Verplaatsen naar",
                        childMenu: new ContextMenu([
                            this.webshop.categories.flatMap(c => {
                                if (!this.category || c.id == this.category.id) {
                                    return []
                                }
                                return [new ContextMenuItem({
                                    name: c.name,
                                    action: () => {
                                        const categoryPatch = Category.patch({
                                            id: c.id
                                        })
                                        categoryPatch.productIds.addPut(this.product.id)

                                        const categoryPatch2 = Category.patch({
                                            id: this.category!.id
                                        })
                                        categoryPatch2.productIds.addDelete(this.product.id)
                                        
                                        const webshopPatch = PrivateWebshop.patch({
                                            id: this.webshop.id,
                                        })
                                        webshopPatch.categories.addPatch(categoryPatch)
                                        webshopPatch.categories.addPatch(categoryPatch2)
                                        this.$emit("patch", webshopPatch)
                                        return true;
                                    }
                                })]
                            })
                        ])
                    }),
                ] : [])
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
