<template>
    <label class="suffix-input input" :class="{ error: !valid }">
        <input
            ref="input"
            v-model="internalValue"
            type="text"
            :spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="none"
            v-bind="$attrs"
            @focus="onFocus"
            @blur="onBlur"
        >
        <div class="suffix" :class="{ fade: fadeSuffix || focussed }">
            {{ focusSuffix !== null && focussed ? focusSuffix : suffix }}
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

@Component({
    emits: {
        'update:modelValue': (_value: string) => true,
    },
    // Do not include attrs on top level element
    inheritAttrs: false,
})
export default class SuffixInput extends VueComponent {
    valid = true;

    /** Price in cents */
    @Prop({ default: '' })
    modelValue!: string;

    @Prop({ default: '' })
    suffix!: string;

    @Prop({ default: true })
    fadeSuffix!: boolean;

    @Prop({ default: null })
    focusSuffix!: string | null;

    focussed = false;

    onFocus(event) {
        this.focussed = true;
        this.$emit('focus', event);
    }

    onBlur(event) {
        this.focussed = false;
        this.$emit('blur', event);
    }

    get internalValue() {
        return this.modelValue;
    }

    set internalValue(val: string) {
        this.$emit('update:modelValue', val);
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.input.suffix-input {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0;
    align-items: stretch;
    overflow: visible;

    & > .suffix {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        opacity: 1;
        transition: opacity 0.2s;

        &.fade {
            opacity: 0.5;
        }

        box-sizing: border-box;

        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});
        display: block;

        @media (max-width: 350px) {
            letter-spacing: -0.5px;
        }
    }

    & > input {
        box-sizing: border-box;
        display: block;
        width: auto;
        min-width: 0;

        padding: 5px 15px;
        margin: -5px -15px;

        padding-right: 0;
        margin-right: 0;

        // Clicking on the suffix should set the cursor to the start + allow text selection easily
        padding-left: 200px;
        margin-left: -200px;

        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});

        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }
}
</style>
