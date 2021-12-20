<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>{{ optionMenu.name || 'Naamloos' }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="editOptionMenu">
                    <span class="icon edit" />
                    <span>Wijzig</span>
                </button>
                <button class="button text only-icon-smartphone" type="button" @click="addOption">
                    <span class="icon add" />
                    <span>Keuze</span>
                </button>
            </div>
        </h2>

        <OptionMenuOptions :option-menu="optionMenu" @patch="addOptionMenuPatch" />
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { Option, OptionMenu, Product } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditOptionMenuView from './EditOptionMenuView.vue';
import EditOptionView from './EditOptionView.vue';
import OptionMenuOptions from './OptionMenuOptions.vue';

@Component({
    components: {
        STListItem,
        OptionMenuOptions
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class OptionMenuSection extends Mixins(NavigationMixin) {
    @Prop({})
    optionMenu: OptionMenu

    @Prop({})
    product: Product

    addOption() {
        const option = Option.create({})
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPut(option)
        
        this.present(new ComponentWithProperties(EditOptionView, { optionMenu: this.optionMenu.patch(p), option, isNew: true, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
            // Merge both patches
            const product = Product.patch({ id: this.product.id })
            product.optionMenus.addPatch(p.patch(patch))
            this.$emit("patch", product)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    editOptionMenu() {
        this.present(new ComponentWithProperties(EditOptionMenuView, { product: this.product, optionMenu: this.optionMenu, isNew: false, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            this.$emit("patch", patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addOptionMenuPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        const p = Product.patch({ id: this.product.id })
        p.optionMenus.addPatch(OptionMenu.patch(Object.assign({}, patch, { id: this.optionMenu.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.$emit("patch", patch)
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
}
</script>
