<template>
    <div class="date-selection-container input-icon-container right icon arrow-down-small gray">
        <div v-if="$isMobile" class="input selectable" :class="{placeholder: value === null}" @click="openContextMenu(true)">
            <div>{{ dateText }}</div>
        </div>
        <div v-else class="input selectable" :class="{placeholder: value === null}" @click="focusFirst()" @mousedown.prevent>
            <div @click.prevent @mouseup.prevent>
                <input ref="dayInput" v-model="dayText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(0)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(0)" @input="dayText = $event.target.value; onTyping();">
                <span>{{ dayText }}</span>
            </div>

            <span :class="{hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="monthInput" v-model="monthText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(1)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(1)" @input="monthText = $event.target.value; onTyping();">
                <span v-if="hasFocus">{{ monthText }}</span>
                <span v-else>{{ monthTextLong }}</span>
            </div>

            <span :class="{hide: !hasFocus}">/</span>

            <div @click.prevent @mouseup.prevent>
                <input ref="yearInput" v-model="yearText" inputmode="numeric" autocomplete="off" @change="updateDate" @focus.prevent="onFocus(2)" @blur="onBlur" @click.prevent @mouseup.prevent @mousedown.prevent="onFocus(2)" @input="yearText = $event.target.value; onTyping();">
                <span>{{ yearText }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Component, Mixins,Prop, Watch } from "vue-property-decorator";

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

    hasFocus = false;
    hasFocusUnbounced = false;

    dayText = ""
    monthText = ""
    yearText = ""

    displayedComponent: ComponentWithProperties | null = null

    mounted() {
        this.updateTextStrings()

        document.addEventListener("keydown", this.onKey);
    }

    updateTextStrings() {
        this.dayText = this.value ? this.value.getDate().toString() : ""
        this.monthText = this.value ? (this.value.getMonth() + 1).toString() : ""
        this.yearText = this.value ? this.value.getFullYear().toString() : ""
    }

    @Watch("value")
    onValueChange() {
        this.updateTextStrings()
    }

    get monthTextLong() {
        return this.value ? Formatter.month(this.value.getMonth() + 1) : ""
    }

    get numberInputs() {
        return [this.$refs.dayInput, this.$refs.monthInput, this.$refs.yearInput]
    }

    get numberConfig() {
        return [
            {
                maxLength: 2,
                max: 31,
                min: 1,
                type: "day",
                getValue: () => {
                    return this.dayText
                },
                setValue: (value: string) => {
                    this.dayText = value
                    this.updateDate()
                }
            },
            {
                maxLength: 2,
                max: 12,
                min: 1,
                type: "month",
                getValue: () => {
                    return this.monthText
                },
                setValue: (value: string) => {
                    this.monthText = value
                    this.updateDate()
                }
            },
            {
                maxLength: 4,
                max: 2100,
                min: 1900,
                type: "year",
                getValue: () => {
                    return this.yearText
                },
                setValue: (value: string) => {
                    this.yearText = value
                    this.updateDate()
                }
            }
        ]
    }

    blurAll() {
        // Blur all
        for (let index = 0; index < this.numberInputs.length; index++) {
            const element = this.numberInputs[index] as HTMLInputElement;
            if (!element) {
                continue
            }
            element.blur()
        }
    }

    selectNext(index: number) {
        if (index < 0) {
            return
        }

        if (index >= this.numberInputs.length) {
            // Remove extra characters of last input
            const config = this.numberConfig[index - 1]
            let val = config.getValue().replace(/[^0-9]/g, "")

            while(val.length >= 2) {
                const shorter = val.substring(0, val.length - 1)
                if (this.isFull(shorter, config)) {
                    val = shorter
                } else {
                    break
                }
            }

            config.setValue(val)

            // Blur all
            this.blurAll()

            return
        }

        if (index >= 1) {
            const config = this.numberConfig[index - 1]
            const val = config.getValue()

            // Get location of first special character after a number
            const firstSpecialCharacter = val.search(/[0-9][^0-9]/)
            const cutIndex = firstSpecialCharacter > -1 ? Math.min(firstSpecialCharacter + 1, config.maxLength, val.length) : Math.min(config.maxLength, val.length)

            if (val.length > cutIndex) {
                config.setValue(val.substr(0, cutIndex).replace(/[^0-9]/g, ""))

                const currentConfig = this.numberConfig[index]

                const moveText = val.substr(cutIndex).replace(/^[^0-9]+/, "");
                currentConfig.setValue(moveText + currentConfig.getValue())

                if (this.isFull(currentConfig.getValue(), currentConfig)) {
                    this.selectNext(index + 1)
                    return
                }
            } else {
                // Clean previous
                config.setValue(val.replace(/[^0-9]/g, ""))
            }
        }

        (this.numberInputs[index] as HTMLInputElement).focus();

        if ((this.numberInputs[index] as HTMLInputElement).value.length > 0) {
            // iOS fix
            (this.numberInputs[index] as HTMLInputElement).select();
        }
    }

    onBlur() {
        this.hasFocus = false

        // Sometimes the blur happens without a onChange event, so we always need to update the address after a blur
        // it will only make the errors visible if hasFocus is still false after 200ms
        // this.updateAddress()

        setTimeout(() => {
            this.hasFocusUnbounced = this.hasFocus
        }, 50)
    }

    isFull(value: string, config) {
        if (value.length >= config.maxLength) {
            return true
        }

        // If any addition of a zero would go above maximum value
        const valueWithZero = parseInt(value + "0")
        if (valueWithZero > config.max) {
            return true
        }
        
        return false
    }

    onTyping() {
        // Check if we can move to the next field
        const focusedInput = document.activeElement as HTMLInputElement
        const index = this.numberInputs.indexOf(focusedInput)

        if (index != -1) {
            // TODO remove and split on special characters
            // todo: automatically move extra characters to the next field

            // Check move to next date
            if (this.isFull(focusedInput.value, this.numberConfig[index])) {
                this.selectNext(index + 1)
            }
        }
    }

    focusFirst() {
        if (!this.hasFocus) {
            this.onFocus(0)
        }
    }

    onFocus(index) {
        this.hasFocus = true
        this.hasFocusUnbounced = true
        this.openContextMenu(false);

        this.selectNext(index)
    }

    @Watch("hasFocusUnbounced")
    onHasFocusUnbouncedChanged() {
        if (!this.hasFocusUnbounced) {
            this.hideDisplayedComponent({unlessFocused: true})

            // Clear invalid date text
            this.updateTextStrings()
        }
    }

    updateDate() {
        const date = this.textDate

        if (date) {
            this.emitDate(date)
            if (this.displayedComponent) {
                const instance = this.displayedComponent.componentInstance();
                if (instance) {
                    (instance as any).setDateValue(date);
                }
            }
        }
    }

    get textDate() {
        const day = parseInt(this.dayText.replace(/[^0-9]/g, ""))
        const month = parseInt(this.monthText.replace(/[^0-9]/g, ""))
        const year = parseInt(this.yearText.replace(/[^0-9]/g, ""))
        if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const date = new Date(year, month - 1, day)
            if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
                return date;
            }
        }
        return null
    }

    get isValidTextDate() {
        return this.textDate !== null
    }

    get dateText() {
        return this.value ? Formatter.date(this.value, true) : this.placeholder
    }

    emitDate(value: Date | null) {
        if (!value) {
            this.$emit('update:modelValue', null)
            return
        }
        const d = new Date(value.getTime())
        if (this.value) {
            d.setHours(this.value.getHours(), this.value.getMinutes(), 0, 0)
        } else {
            d.setHours(12, 0, 0, 0)
        }
        this.$emit('update:modelValue', d)
    }

    openContextMenu(autoDismiss = true) {
        if (this.displayedComponent) {
            return;
        }

        const el = this.$el as HTMLElement;
        const displayedComponent = new ComponentWithProperties(DateSelectionView, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight - 2,
            wrapHeight: el.offsetHeight - 4,
            xPlacement: 'left',
            autoDismiss,
            //preferredWidth: el.offsetWidth, 
            selectedDay: this.value ? new Date(this.value) : new Date(),
            allowClear: !this.required,
            setDate: (value: Date | null) => {
                this.emitDate(value)
            },
            onClose: () => {
                this.blurAll()
                this.displayedComponent = null
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
        this.displayedComponent = displayedComponent;
    }

    hideDisplayedComponent({unlessFocused} = {unlessFocused: false}) {
        if (this.displayedComponent) {
            const instance = this.displayedComponent.componentInstance();
            if (instance) {
                if (unlessFocused && instance.$el && document.activeElement && instance.$el.contains(document.activeElement)) {
                    // Add an event listener to focus yearInput when blur 
                    const activeElement = document.activeElement
                    const listener = () => {
                        activeElement.removeEventListener("change", listener)
                        activeElement.removeEventListener("focusout", listener)
                        this.selectNext(2)
                    }
                    activeElement.addEventListener("change", listener)
                    activeElement.addEventListener("focusout", listener)

                    return;
                }
                (instance as any).dismiss();
            }
            this.displayedComponent = null;
        }
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    beforeUnmount() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!this.isFocused) {
            return;
        }

        const focusedInput = document.activeElement as HTMLInputElement
        const index = this.numberInputs.indexOf(focusedInput)

        if (index == -1) {
            return;
        }

        const config = this.numberConfig[index];

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft") {
            if (index > 0) {
                this.selectNext(index - 1)
            } else {
                this.blurAll()
            }
            event.preventDefault();
        } else if (key === "ArrowRight") {
            this.selectNext(index + 1)
            event.preventDefault();
        } else if (key === "ArrowUp" || key === "PageUp") {
            const value = parseInt(config.getValue())
            if (!isNaN(value) && value < config.max) {
                config.setValue((value + 1).toString())
            }
            event.preventDefault();
        } else if (key === "ArrowDown" || key === "PageDown") {
            const value = parseInt(config.getValue())
            if (!isNaN(value) && value > config.min) {
                config.setValue((value - 1).toString())
            }
            event.preventDefault();
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.date-selection-container {
    .input.placeholder {
        color: $color-gray-5;
    }

    .input {
        padding: 5px 0;
        padding-right: 40px;
        padding-left: 10px;

        display: grid;
        grid-template-columns: auto auto auto auto auto;
        align-items: start;
        justify-content: start;

        > span {
            color: $color-gray-5;
            pointer-events: none;
            width: 10px;
            transition: width 0.2s, opacity 0.2s;
            text-align: center;
            margin: 0 -5px;

            &.hide {
                display: none;
            }
        }

        > div {
            margin: -5px 0;
            padding: 5px;
            position: relative;
            overflow: hidden;
            text-overflow: ellipsis;
            height: 100%;

            &:focus-within {
                // color: $color-primary;
            }

            > span {
                pointer-events: none;
            }

            > input {
                left: 0;
                top: 0;
                bottom: 0;
                right: 0;
                width: 100%;
                height: 100%;
                position: absolute;
                @extend .style-input;
                line-height: 1;
                box-sizing: border-box;
                opacity: 0;
                padding: 5px;
                padding-right: 0; // Fix being able to scroll inside the input
                overflow: hidden;
                caret-color: $color-primary;

                -webkit-user-select: none;
        -webkit-touch-callout: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-user-modify: read-write-plaintext-only;
                user-modify: read-write-plaintext-only;

                &:focus {
                    opacity: 1;

                    + span {
                        opacity: 0;
                    }
                }
            }

            // Remove dotted line in Firefox
            > input:-moz-focusring {
                color: transparent;
                text-shadow: 0 0 0 #000;
            }
        }
    }
}
</style>