<template>
    <div class="input-icon-container right icon arrow-down-small gray">
        <div class="input" @click="openContextMenu">
            {{ dateText }}
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop } from "vue-property-decorator";

import DateSelectionView from '../overlays/DateSelectionView.vue';

@Component
export default class DateSelection extends Mixins(NavigationMixin) {
    @Prop({ default: () => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
    } })
    value: Date

    get dateText() {
        return Formatter.date(this.value, true)
    }

    openContextMenu(event) {
        const el = this.$el as HTMLElement;
        const displayedComponent = new ComponentWithProperties(DateSelectionView, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight - 2,
            //preferredWidth: el.offsetWidth, 
            selectedDay: this.value,
            setDate: (value: Date) => {
                const d = new Date(value.getTime())
                d.setHours(this.value.getHours(), this.value.getMinutes(), 0, 0)
                this.$emit("input", d)
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>
