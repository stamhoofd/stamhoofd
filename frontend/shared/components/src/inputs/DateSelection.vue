<template>
    <div class="date-selection-container input-icon-container right icon arrow-down-small gray">
        <div class="input selectable" :class="{placeholder: value === null}" @click="openContextMenu">
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
        value: Date | null

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: "Kies een datum" })
        placeholder!: string

    get dateText() {
        return this.value ? Formatter.date(this.value, true) : this.placeholder
    }

    openContextMenu(event) {
        const el = this.$el as HTMLElement;
        const displayedComponent = new ComponentWithProperties(DateSelectionView, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight - 2,
            wrapHeight: el.offsetHeight - 4,
            xPlacement: 'left',
            //preferredWidth: el.offsetWidth, 
            selectedDay: this.value ? new Date(this.value) : new Date(),
            allowClear: !this.required,
            setDate: (value: Date | null) => {
                if (!value) {
                    this.$emit("input", null)
                    return
                }
                const d = new Date(value.getTime())
                if (this.value) {
                    d.setHours(this.value.getHours(), this.value.getMinutes(), 0, 0)
                } else {
                    d.setHours(12, 0, 0, 0)
                }
                this.$emit("input", d)
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>


<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

.date-selection-container {
    .input.placeholder {
        color: $color-gray-5;
    }
}
</style>