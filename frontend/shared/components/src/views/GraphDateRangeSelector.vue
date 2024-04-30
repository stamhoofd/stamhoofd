<template>
    <button class="button text" type="button" @click="chooseRange">
        <span>{{ value ? value.name : '—' }}</span>
        <span class="icon arrow-down-small" />
    </button>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { ContextMenu, ContextMenuItem } from "../overlays/ContextMenu";
import { DateOption } from "./DateRange";

@Component({})
export default class GraphDateRangeSelector extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    value: DateOption | null

    @Prop({ default: null })
    options: DateOption[] | null

    chooseRange(event) {
        if (!this.options) {
            return
        }
        const contextMenu = new ContextMenu([
            [
                ...this.options.map(option => {
                    return new ContextMenuItem({
                        name: option.name,
                        action: () => {
                            this.$emit('update:modelValue', option);
                            return true;
                        }
                    })
                })
            ]
        ]);
        contextMenu.show({ button: event.currentTarget, xPlacement: "left" }).catch(console.error);
    }
}
</script>