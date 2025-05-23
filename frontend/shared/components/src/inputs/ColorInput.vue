<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label for="color-input" class="input color-input-box" :class="{ hasColor: !!hasColor }">
            <input v-model="colorRaw" class="text-input" pattern="#[0-9A-Fa-f]{6}" type="text" :placeholder="placeholder" :autocomplete="autocomplete" @blur="validate(false, false)">
            <input id="color-input" v-model="pickerColor" pattern="#[0-9A-Fa-f]{6}" class="color-input" type="color">
            <span class="color" :style="{ backgroundColor: myColor }" :class="{empty: !myColor}" />
            <span v-if="!myColor" class="icon arrow-down-small" />
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
    },
    emits: ['update:modelValue'],
})
export default class ColorInput extends VueComponent {
    @Prop({ default: '' })
    title: string;

    @Prop({ default: null })
    validator: Validator | null;

    @Prop({ default: () => [] })
    disallowed: string[];

    colorRaw = '';
    hasColor = '';

    @Prop({ default: null })
    modelValue!: string | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: '' })
    placeholder!: string;

    @Prop({ default: 'color' })
    autocomplete!: string;

    errorBox: ErrorBox | null = null;

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            return;
        }
        this.colorRaw = val;
    }

    get pickerColor() {
        if (!this.hasColor) {
            // Hacky solution to make black colors work from emtpy -> black
            return '#000001';
        }
        return this.hasColor || '#000000';
    }

    set pickerColor(val: string) {
        this.colorRaw = val || '#000000';
        this.validate(false, true);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true, false);
            });
        }

        this.colorRaw = this.modelValue ?? '';
        this.hasColor = this.colorRaw;
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    get myColor() {
        return this.hasColor ?? 'black';
    }

    validate(final = true, silent = false) {
        this.colorRaw = this.colorRaw.trim().toUpperCase();

        if (!this.required && this.colorRaw.length === 0) {
            if (!silent) {
                this.errorBox = null;
            }
            this.hasColor = '';

            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null);
            }
            return true;
        }

        if (this.colorRaw.length === 6 && !this.colorRaw.startsWith('#')) {
            this.colorRaw = '#' + this.colorRaw;
        }

        const regex = /^#[0-9A-F]{6}$/;

        if (!regex.test(this.colorRaw)) {
            this.hasColor = '';

            if (!silent) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`38b06bba-0683-44ca-9164-c0aff5f9c860`),
                    field: 'color',
                }));
            }
            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null);
            }
            return false;
        }

        if (this.disallowed.includes(this.colorRaw)) {
            this.hasColor = '';

            if (!silent) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`b122a8f8-ddc7-4b9c-abf4-3c3f356a5071`),
                    field: 'color',
                }));
            }

            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null);
            }

            return false;
        }

        this.hasColor = this.colorRaw;

        if (this.colorRaw !== this.modelValue) {
            this.$emit('update:modelValue', this.colorRaw);
        }
        if (!silent) {
            this.errorBox = null;
        }
        return true;
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.color-input-box {
    position: relative;
    padding-top: 0 !important;
    padding-bottom: 0;
    padding-right: 40px;

    .text-input {
        width: 100%;
        padding: 5px 0;
        height:  calc(#{$input-height} - 2 * #{$border-width});
        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});
        box-sizing: border-box;

    }

    .color-input {
        appearance: none;
        opacity: 0;
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translate(0, -50%);
        width: 15px;
        height: 15px;
        border-radius: 3px;
    }

    > span.color {
        position: absolute;
        right: 10px;
        top: 50%;
        width: 15px;
        height: 15px;
        border-radius: 3px;
        box-sizing: border-box;
        transform: translate(0, -50%);
    }

    > span.icon {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translate(0, -50%);
    }
}
</style>
