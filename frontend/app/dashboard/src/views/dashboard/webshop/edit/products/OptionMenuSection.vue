<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div @contextmenu.prevent="showContextMenu">
                {{ optionMenu.name || 'Naamloos' }}
                <span class="style-tag inline-first">{{ optionMenu.multipleChoice ? 'Keuzemenu' : 'Keuzemenu' }}</span>
            </div>
            <div>
                <button class="button icon edit" type="button" @click="editOptionMenu" />
                <button class="button icon add" type="button" @click="addOption" />
            </div>
        </h2>

        <OptionMenuOptions :option-menu="optionMenu" @patch="addOptionMenuPatch" />
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, VersionBox } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, STListItem, Toast } from "@stamhoofd/components";
import { Option, OptionMenu, Product, Version } from "@stamhoofd/structures"
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

    mounted() {
        this.$el.addEventListener("copy", (event) => {
            try {
                (event as any).clipboardData.setData("text/plain", this.optionMenu.name || 'Naamloos');
                (event as any).clipboardData.setData("web stamhoofd/webshop-option-menu", JSON.stringify(new VersionBox(this.optionMenu).encode({version: Version})));
                event.preventDefault();
            } catch (e) {
                console.error(e);
            }
        });
    }

    showContextMenu(event) {
        const clipboardSupported = !!navigator.clipboard && !!window.ClipboardItem
        const menu = new ContextMenu([
            [
                ...(clipboardSupported ? [new ContextMenuItem({
                    name: "Kopiëren",
                    icon: "copy",
                    action: () => {
                        const blob = new Blob([
                            JSON.stringify(new VersionBox(this.optionMenu).encode({version: Version}))
                        ], {type: "web stamhoofd/webshop-option-menu"});
                        navigator.clipboard.write(
                            [
                                new ClipboardItem({
                                    ['web stamhoofd/webshop-option-menu']: blob,
                                })
                            ]
                        ).then(() => {
                            new Toast((this as any).$isMac ? 'Keuzemenu gekopieërd. Gebruik CMD+V om dit keuzemenu ergens anders te plakken' : 'Keuzemenu gekopieërd. Gebruik CTRL+V om dit keuzemenu ergens anders te plakken', 'copy').show()
                        }).catch(console.error)
                        return true;
                    }
                })]:[]),
                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    action: () => {
                        this.delete()
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }

    addOption() {
        const option = Option.create({})
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPut(option)
        
        this.present(new ComponentWithProperties(EditOptionView, { optionMenu: this.optionMenu.patch(p), option, isNew: true, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
            // Merge both patches
            const product = Product.patch({ id: this.product.id })
            product.optionMenus.addPatch(p.patch(patch))
            this.$emit("patch", product)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    editOptionMenu() {
        this.present(new ComponentWithProperties(EditOptionMenuView, { product: this.product, optionMenu: this.optionMenu, isNew: false, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
            this.$emit("patch", patch)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    addOptionMenuPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        const p = Product.patch({ id: this.product.id })
        p.optionMenus.addPatch(OptionMenu.patch(Object.assign({}, patch, { id: this.optionMenu.id })))
        this.addPatch(p)
    }

    delete() {
        const p = Product.patch({ id: this.product.id })
        p.optionMenus.addDelete(this.optionMenu.id)
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
