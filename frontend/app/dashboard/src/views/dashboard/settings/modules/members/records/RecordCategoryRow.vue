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
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { Organization, RecordCategory } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditProductView from './EditRecordCategoryView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class RecordCategoryRow extends Mixins(NavigationMixin) {
    @Prop({})
    category: RecordCategory

    @Prop({})
    organization: Organization

    editCategory() {
        this.present(new ComponentWithProperties(EditProductView, { 
            category: this.category, 
            organization: this.organization, 
            isNew: false, 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.$emit("patch", patch)

                // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
            }
        }).setDisplayStyle("popup"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
}
</script>