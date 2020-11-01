<template>
    <STListItem :selectable="true" @click="editOption()" class="right-description right-stack no-margin">
        {{ option.name }}
        <template slot="right">
            {{ option.price | priceChange }}
            <button class="button icon arrow-up gray" @click.stop="moveUp"/>
            <button class="button icon arrow-down gray" @click.stop="moveDown"/>
            <span  class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { Option, OptionMenu, PrivateWebshop, Product, ProductPrice } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditOptionView from './EditOptionView.vue';
import EditProductPriceView from './EditProductPriceView.vue';

@Component({
    components: {
        STListItem
    },
    filters: {
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class OptionRow extends Mixins(NavigationMixin) {
    @Prop({})
    optionMenu: OptionMenu

    @Prop({})
    option: Option

    editOption() {
        this.present(new ComponentWithProperties(EditOptionView, { option: this.option, optionMenu: this.optionMenu, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
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

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
