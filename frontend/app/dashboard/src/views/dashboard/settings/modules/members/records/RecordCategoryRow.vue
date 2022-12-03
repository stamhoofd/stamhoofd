<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ category.name }}
        </h3>
        <p v-if="category.filter" class="style-description-small">
            {{ category.filter.getString(filterDefinitionsForCategory()) }}
        </p>

        <template slot="right">
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { FilterDefinition, RecordAnswer, RecordCategory } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordCategoryQuestionsView from './EditRecordCategoryQuestionsView.vue';

@Component({
    components: {
        STListItem
    },
    directives: {
        longPress: LongPressDirective
    }
})
export default class RecordCategoryRow<T> extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    category: RecordCategory

    @Prop({ required: false, default: null })
    parentCategory!: RecordCategory | null

    @Prop({ required: true })
    categories: RecordCategory[]

    @Prop({ required: true })
    filterDefinitions!: (categories: RecordCategory[]) => FilterDefinition<T>[]

    @Prop({ required: true })
    filterValueForAnswers!: (answers: RecordAnswer[]) => T

    filterDefinitionsForCategory() {
        const rootIndex = this.categories.findIndex(c => c.id === this.category.id)
        if (rootIndex === -1) {
            return this.filterDefinitions([])
        }
        const rootCategories = this.categories.slice(0, rootIndex + 1)
        return this.filterDefinitions(rootCategories)
    }

    editCategory() {
        this.present(new ComponentWithProperties(EditRecordCategoryQuestionsView, {
            categoryId: this.category.id,
            rootCategories: this.categories,
            filterDefinitions: this.filterDefinitions,
            filterValueForAnswers: this.filterValueForAnswers,
            isNew: false,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    addPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
        this.$emit("patch", patch)
    }

    moveUp() {
        const index = this.categories.findIndex(c => c.id === this.category.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        p.addMove(this.category.id, this.categories[moveTo]?.id ?? null)
        this.addPatch(p)
    }
     
    moveDown() {
        const index = this.categories.findIndex(c => c.id === this.category.id)
        if (index == -1 || index >= this.categories.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        p.addMove(this.category.id, this.categories[moveTo]?.id ?? null)
        this.addPatch(p)
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