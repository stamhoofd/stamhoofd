<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ category.name || 'Naamloos' }}
        </h2>

        <p v-if="!category.productIds.length" class="style-description">
            Leeg
        </p>
        <p v-else-if="category.productIds.length === 1" class="style-description">
            Eén artikel
        </p>
        <p v-else class="style-description">
            {{ category.productIds.length }} artikels
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { Category, PrivateWebshop } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditCategoryView from './EditCategoryView.vue';

@Component({
    components: {
        STListItem
    },
    directives: {
        LongPress: LongPressDirective,
    }
})
export default class CategoryRow extends Mixins(NavigationMixin) {
    @Prop({})
        category: Category

    @Prop({})
        webshop: PrivateWebshop

    editCategory() {
        this.present(new ComponentWithProperties(EditCategoryView, { category: this.category, webshop: this.webshop, isNew: false, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // This same patch could also patch products ;)
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

    async delete(keepArticles = false) {
        if (!(await CenteredMessage.confirm(keepArticles ? 'Deze categorie verwijderen en alle artikels erin behouden?' : 'Deze categorie en artikels verwijderen?', 'Verwijderen'))) {
            return
        }
        const p = PrivateWebshop.patch({ id: this.webshop.id })
        p.categories.addDelete(this.category.id)

        if (!keepArticles) {
            for (const id of this.category.productIds) {
                p.products.addDelete(id)
            }
        }

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
                ...(this.webshop.categories.length === 1 ? [
                    new ContextMenuItem({
                        name: "Verwijder en behoud artikels",
                        action: () => {
                            this.delete(true).catch(console.error)
                            return true;
                        }
                    }),
                ] : []),
                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    action: () => {
                        this.delete(false).catch(console.error)
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>
