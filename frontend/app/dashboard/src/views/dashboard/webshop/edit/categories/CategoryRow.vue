<template>
    <STListItem :selectable="true" class="right-stack" @click="editCategory()">
        {{ category.name || 'Naamloos' }}

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
import { Category, PrivateWebshop } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditCategoryView from './EditCategoryView.vue';

@Component({
    components: {
        STListItem
    },
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

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
}
</script>
