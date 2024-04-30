<template>
    <div>
        <label class="radio" :class="{ 'with-text': hasDefaultSlot }">
            <input ref="radio" v-model="radioButtonValue" type="radio" :name="name" :value="value" :autocomplete="autocomplete" :disabled="disabled">
            <div>
                <div />
                <div><slot /></div>
            </div>
        </label>
    </div>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({
    "model": {
        "prop": "modelValue",
        "event": "change"
    },
})
export default class Radio extends Vue {
    @Prop({ default: "", type: String })
    name!: string;

    @Prop({ default: "", type: String })
    autocomplete!: string;

    @Prop({ default: "" })
    value!: any;

    @Prop({})
    modelValue!: any;

    @Prop({ default: false })
    disabled!: boolean;

    get hasDefaultSlot() {
        return !!this.$slots.default
    }

    get radioButtonValue() {
        return this.modelValue;
    }

    set radioButtonValue(value) {
        this.$emit("change", value)

        // Add support for a model that doesn't change
        this.$nextTick(() => {
            if (this.radioButtonValue != value) {
                if (this.$refs.radio) {
                    (this.$refs.radio as any).checked = (this.radioButtonValue === this.value);
                }
            }
        })
    }
}
</script>
