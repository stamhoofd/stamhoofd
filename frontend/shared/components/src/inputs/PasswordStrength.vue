<template>
    <STInputBox :title="$t(`439eff64-59e0-48b1-9e01-c3765e260c1e`)">
        <div class="password-strength">
            <div :style="{ width: strength+'%' }" :class="type"/>
        </div>
        <p v-if="!modelValue" class="style-description-small">
            {{ $t('03686691-b3fb-47f9-94d5-c02dccd1cb09') }}
        </p>
        <p v-else-if="warning.length > 0" class="style-description-small">
            {{ warning }}
        </p>
        <p v-else-if="duration <= 60*60" class="style-description-small">
            {{ $t('641f4898-3bf5-4292-8688-527e3dd91f8d') }}
        </p>
        <p v-else-if="duration <= 60*60*24" class="style-description-small">
            {{ $t('f0f0bf80-c31e-484c-919e-2031f694d3e7') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30" class="style-description-small">
            {{ $t('8524454f-d601-4315-9cee-df640bce1c5b') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30*12" class="style-description-small">
            {{ $t('fe1abd25-9987-451a-92a1-de8c8ae7cffa') }}
        </p>
        <p v-else class="style-description-small">
            {{ $t('1199741c-7541-4d7b-93d3-e8a75a562079') }}
        </p>

        <template #right>
            <span v-if="modelValue" :class="type" class="password-strength-description">{{ description }}</span>
        </template>
    </STInputBox>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";

import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    }
})
export default class PasswordStrength extends VueComponent {
    @Prop({ default: null })
        modelValue!: string | null

    strength = 0
    duration = 0
    warning = ""

    calculateCounter = 0
    loading = false

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null || val.length === 0) {
            this.calculateCounter++
            this.strength = 0;
            this.duration = 0;
            this.loading = false
            return
        }
        this.calculateStrength(val).catch(e => {
            console.error(e)
        })
    }

    async calculateStrength(password: string) {
        this.calculateCounter++
        const saved = this.calculateCounter
        this.loading = true

        try {
            const calculator = await import(/* webpackChunkName: "PasswordStrengthCalculator" */ "./PasswordStrengthCalculator")
            if (saved !== this.calculateCounter) {
                // skip
                return
            }
            const result = calculator.checkPassword(password)
            if (saved !== this.calculateCounter) {
                // skip
                return
            }
            this.warning = result.feedback.warning ?? ""
            this.strength = result.score*25
            this.duration = result.crackTimesSeconds.offlineSlowHashing1e4PerSecond

        } catch (e) {
            // ignore
        }

        if (saved === this.calculateCounter) {
            this.loading = false
        }
    }

    get type() {
        const strength = this.strength
        if (strength === 0) {
            return "none"
        }

        if (strength < 50) {
            return "error"
        }

        if (strength < 100) {
            return "warning"
        }

        return "success"
    }

    get description() {
        const strength = this.strength
        if (strength < 50) {
            return "Heel zwak"
        }

        if (strength < 75) {
            return "Zwak"
        }

        if (strength < 100) {
            return "Matig"
        }

        return "Sterk"
    }

    get detailDescription() {
        if (this.warning.length > 0) {
            return this.warning
        }
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.password-strength {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: $color-border;
    position: relative;
    overflow: hidden;
    margin-top: 5px !important;

    > div {
        left: 0;
        top: 0;
        bottom: 0;
        position: absolute;
        background: $color-primary;
        border-radius: 2px;
        width: 0;
        transition: width 0.2s, background-color 0.2s;

        &.none {
            background: $color-border;
        }

        &.error {
            background: $color-error;
        }

        &.warning {
            background: $color-warning;
        }

        &.success {
            background: $color-success;
        }
    }
}

.password-strength-description {
    font-weight: bold;

    &.none {
        color: $color-gray-text;
    }

    &.error {
        color: $color-error;
    }

    &.warning {
        color: $color-warning;
    }

    &.success {
        color: $color-success;
    }   
}
</style>
