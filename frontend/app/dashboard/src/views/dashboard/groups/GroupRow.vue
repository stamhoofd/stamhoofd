<template>
    <STListItem :selectable="true" class="right-stack" @click="editProduct()">
        <template slot="left">
            <img v-if="imageSrc" :src="imageSrc" class="group-row-image">
        </template>
        
        <h2 class="style-title-list">
            {{ group.settings.name }}
        </h2>

        <template slot="right">
            <button class="button icon arrow-up gray" type="button" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" type="button" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { Group, Organization } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class GroupRow extends Mixins(NavigationMixin) {
    @Prop({})
    group: Group

    @Prop({})
    organization: Organization

    get imageSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(50, 50)
    }

    editProduct() {
        this.present(new ComponentWithProperties(EditGroupView, { 
            group: this.group, 
            organization: this.organization, 
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-row-image {
    width: 50px;
    height: 50px;
    margin: -5px 0;
    border-radius: $border-radius;
}
</style>
