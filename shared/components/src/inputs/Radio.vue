<template>
    <label class="radio">
        <input v-model="radioButtonValue" type="radio" :name="name" :value="value" :autocomplete="autocomplete">
        <div>
            <div />
            <div><slot /></div>
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    model: {
        prop: 'modelValue',
        event: 'change'
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

    get radioButtonValue() {
        return this.modelValue;
    }

    set radioButtonValue(value) {
        this.$emit("change", value)
    }
}
</script>
