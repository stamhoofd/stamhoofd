<template>
    <STListItem :selectable="true" @click="editCategory()">
        {{ category.settings.name }}

        <template slot="right">
            <button class="button icon arrow-up gray" @click.stop="moveUp"/>
            <button class="button icon arrow-down gray" @click.stop="moveDown"/>
            <span  class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { GroupCategory, Organization } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditCategoryGroupsView from './EditCategoryGroupsView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class GroupCategoryRow extends Mixins(NavigationMixin) {
    @Prop({})
    category: GroupCategory

    @Prop({})
    organization: Organization

    editCategory() {
        this.present(new ComponentWithProperties(EditCategoryGroupsView, { 
            category: this.category, 
            organization: this.organization, 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.$emit("patch", patch)
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

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
