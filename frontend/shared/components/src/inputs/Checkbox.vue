<template>
    <div>
        <label :class="{'checkbox': !onlyLine, 'checkbox-line': onlyLine, manual, 'with-text': hasDefaultSlot }" :data-testid="dataTestid" @click="handleClick">
            <input ref="checkbox" v-model="checkboxValue" type="checkbox" :disabled="disabled" :indeterminate.prop="indeterminate">
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
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

@Component({
    emits: ['update:modelValue'],
})
export default class Checkbox extends VueComponent {
    @Prop({ default: '', type: String })
    name!: string;

    @Prop({ default: false })
    modelValue!: boolean;

    @Prop({ default: false })
    onlyLine!: boolean;

    @Prop({ default: false })
    disabled!: boolean;

    // Set to true to only allow external changes
    @Prop({ default: false })
    manual!: boolean;

    @Prop({ default: false })
    indeterminate!: boolean;

    @Prop({ default: 'checkbox' })
    dataTestid?: string;

    get hasDefaultSlot() {
        return !!this.$slots.default;
    }

    get checkboxValue() {
        return this.modelValue;
    }

    set checkboxValue(value) {
        this.$emit('update:modelValue', value);

        // Add support for a model that doesn't change
        this.$nextTick(() => {
            if (this.checkboxValue !== value) {
                if (this.$refs.checkbox) {
                    (this.$refs.checkbox as any).checked = this.checkboxValue;
                }
            }
        });
    }

    handleClick(e: MouseEvent) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault(); // prevent text-selection behavior
            // this.checkboxValue = !this.checkboxValue;
        }
    }
}
</script>

<style lang="scss">
    .checkbox.manual {
        pointer-events: none;
    }
</style>
