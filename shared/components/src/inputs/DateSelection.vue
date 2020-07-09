<template>
    <div class="input" @click="openContextMenu">
        {{ dateText }}
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";

import DateSelectionView from '../overlays/DateSelectionView.vue';

@Component
export default class DateSelection extends Mixins(NavigationMixin) {
    @Prop({ default: new Date() })
    value: Date

    get dateText() {
        return Formatter.date(this.value)
    }

    openContextMenu(event) {
        const displayedComponent = new ComponentWithProperties(DateSelectionView, {
            x: event.clientX,
            y: event.clientY + 15,
            selectedDay: this.value,
            setDate: (value: Date) => {
                this.$emit("input", value)
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>
