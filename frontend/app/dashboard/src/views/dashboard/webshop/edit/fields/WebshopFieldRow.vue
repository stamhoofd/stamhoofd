<template>
    <STListItem :selectable="true" class="right-stack no-margin" @click="editField()">
        <h2 class="style-title-list">
            {{ field.name || 'Naamloos' }}
        </h2>

        <template slot="right">
            <button class="button icon arrow-up gray" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, Radio,STListItem } from "@stamhoofd/components";
import { WebshopField } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditWebshopFieldView from './EditWebshopFieldView.vue';

@Component({
    components: {
        STListItem,
        Checkbox,
        Radio
    },
    filters: {
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class WebshopFieldRow extends Mixins(NavigationMixin) {
    @Prop({})
    field: WebshopField

    editField() {
        this.present(new ComponentWithProperties(EditWebshopFieldView, { field: this.field, isNew: false, saveHandler: (patch: PatchableArrayAutoEncoder<WebshopField>) => {
            this.$emit("patch", patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }
}
</script>