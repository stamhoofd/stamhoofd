<template>
    <STList v-model="draggableOptions" :draggable="true">
        <OptionRow v-for="option in optionMenu.options" :key="option.id" :option-menu="optionMenu" :option="option" @patch="addPatch" @move-up="moveOptionUp(option)" @move-down="moveOptionDown(option)" />
    </STList>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem } from "@stamhoofd/components";
import { Option, OptionMenu } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

import OptionRow from "./OptionRow.vue"

@Component({
    components: {
        STListItem,
        STList,
        OptionRow
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class OptionMenuOptions extends Mixins(NavigationMixin) {
    @Prop({})
        optionMenu: OptionMenu

    moveOptionUp(option: Option) {
        const index = this.optionMenu.options.findIndex(c => option.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = OptionMenu.patch({})
        p.options.addMove(option.id, this.optionMenu.options[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    moveOptionDown(option: Option) {
        const index = this.optionMenu.options.findIndex(c => option.id === c.id)
        if (index == -1 || index >= this.optionMenu.options.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = OptionMenu.patch({})
        p.options.addMove(option.id, this.optionMenu.options[moveTo].id)
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        this.$emit("patch", patch)
    }

    get draggableOptions() {
        return this.optionMenu.options;
    }

    set draggableOptions(options) {
        if (options.length != this.optionMenu.options.length) {
            return;
        }

        const patch = OptionMenu.patch({})
        for (const p of options.slice().reverse()) {
            patch.options.addMove(p.id, null)
        }
        this.addPatch(patch)
    }
}
</script>
