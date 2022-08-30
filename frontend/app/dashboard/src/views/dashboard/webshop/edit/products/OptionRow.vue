<template>
    <STListItem :selectable="true" class="right-description right-stack" @click="editOption()">
        <Radio v-if="!optionMenu.multipleChoice" slot="left" v-model="isFirst" :value="true" :disabled="true" />
        <Checkbox v-else slot="left" :disabled="true" />

        <h2 class="style-title-list">
            {{ option.name || 'Naamloos' }}
        </h2>
        <p v-if="false" class="style-description">
            Standaard geselecteerd - inbegrepen in prijs
        </p>

        <template slot="right">
            {{ option.price | priceChange }}
            <button type="button" class="button icon arrow-up gray" @click.stop="moveUp" />
            <button type="button" class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, Radio,STListItem } from "@stamhoofd/components";
import { Option, OptionMenu } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditOptionView from './EditOptionView.vue';

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
export default class OptionRow extends Mixins(NavigationMixin) {
    @Prop({})
    optionMenu: OptionMenu

    @Prop({})
    option: Option

    get isFirst() {
        return this.optionMenu.options[0].id === this.option.id
    }

    set isFirst(set: boolean) {
        // udno
    }

    addOptionPatch(patch: AutoEncoderPatchType<Option>) {
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPatch(Option.patch(Object.assign({}, patch, { id: this.option.id })))
        this.$emit("patch", p)
    }

    editOption() {
        this.present(new ComponentWithProperties(EditOptionView, { option: this.option, optionMenu: this.optionMenu, isNew: false,  saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
            this.$emit("patch", patch)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
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
