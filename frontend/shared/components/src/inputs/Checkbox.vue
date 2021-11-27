<template>
    <div>
        <label :class="{'checkbox': !onlyLine, 'checkbox-line': onlyLine, manual}">
            <input ref="checkbox" v-model="checkboxValue" type="checkbox" :disabled="disabled">
            <div>
                <div>
                    <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M1 4L4 8L9 1"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <div><slot /></div>
            </div>
        </label>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    model: {
        prop: 'checked',
        event: 'change'
    },
})
export default class Checkbox extends Vue {
    @Prop({ default: "", type: String })
    name!: string;

    @Prop({ default: false })
    checked!: boolean;

    @Prop({ default: false })
    onlyLine!: boolean;

    @Prop({ default: false })
    disabled!: boolean;

    // Set to true to only allow external changes
    @Prop({ default: false })
    manual!: boolean;

    get checkboxValue() {
        return this.checked;
    }

    set checkboxValue(value) {
        this.$emit("change", value)

        // Add support for a model that doesn't change
        this.$nextTick(() => {
            if (this.checkboxValue != value) {
                if (this.$refs.checkbox) {
                    (this.$refs.checkbox as any).checked = this.checkboxValue;
                }
            }
        })
    }
}
</script>

<style lang="scss">
    .checkbox.manual {
        pointer-events: none;
    }
</style>
