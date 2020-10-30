<template>
    <STListItem :selectable="true" @click="editProduct()">
        {{ product.name }}
        <span slot="right" class="icon arrow-right-small gray"/>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { PrivateWebshop, Product } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditProductView from './EditProductView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class ProductRow extends Mixins(NavigationMixin) {
    @Prop({})
    product: Product

    @Prop({})
    webshop: PrivateWebshop

    editProduct() {
        this.present(new ComponentWithProperties(EditProductView, { product: this.product, webshop: this.webshop, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            this.$emit("patch", patch)

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
