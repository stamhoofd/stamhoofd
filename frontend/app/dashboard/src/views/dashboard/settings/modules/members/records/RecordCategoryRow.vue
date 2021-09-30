<template>
    <STListItem :selectable="true" @click="editCategory()">
        <h2 class="style-title-list">
            {{ category.name }}
        </h2>

        <template slot="right">
            <button class="button icon arrow-up gray" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { RecordCategory } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordCategoryView from './EditRecordCategoryView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class RecordCategoryRow extends Mixins(NavigationMixin) {
    @Prop({})
    category: RecordCategory

    @Prop({})
    categories: RecordCategory[]

    editCategory() {
        this.present(new ComponentWithProperties(EditRecordCategoryView, {
            category: this.category,
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
}
</script>