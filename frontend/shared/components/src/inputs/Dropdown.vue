<template>
    <div class="input-icon-container right icon arrow-down-small gray">
        <select v-model="mappedValue" class="input" :autocomplete="autocomplete" :name="name" @blur="$emit('blur', $event)" @focus="$emit('focus', $event)">
            <slot />
        </select>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    "model": {
        "prop": "value",
        "event": "change"
    },
})
export default class Dropdown extends Mixins(NavigationMixin) {
    @Prop({})
        value: any

    @Prop({ default: undefined })
        autocomplete?: string

    @Prop({ default: undefined })
        name?: string

    get mappedValue() {
        return this.value
    }

    set mappedValue(val: any) {
        this.$emit("change", val)
    }
}
</script>
