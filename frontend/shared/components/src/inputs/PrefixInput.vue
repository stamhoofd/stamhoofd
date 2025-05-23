<template>
    <label class="prefix-input input" :class="{ error: !valid }">
        <div class="prefix" :class="{ fade: fadePrefix || focussed }">
            {{ focusPrefix !== null && focussed ? focusPrefix : prefix }}
        </div>
        <input
            ref="input"
            v-model="internalValue"
            type="text"
            :spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="none"
            @focus="onFocus"
            @blur="onBlur"
        >
    </label>
</template>

<script lang="ts">
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

@Component({
    emits: {
        'update:modelValue': (_value: string) => true,
    },
})
export default class PrefixInput extends VueComponent {
    valid = true;

    /** Price in cents */
    @Prop({ default: '' })
    modelValue!: string;

    @Prop({ default: '' })
    prefix!: string;

    @Prop({ default: '' })
    placeholder!: string;

    @Prop({ default: true })
    fadePrefix!: boolean;

    @Prop({ default: null })
    focusPrefix!: string | null;

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

.input.prefix-input {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0;
    align-items: stretch;
    overflow: visible;

    & > .prefix {
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

        // Clicking on the prefix should set the cursor to the start + allow text selection easily
        padding-left: 200px;
        margin-left: -200px;

        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});

        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }
}
</style>
