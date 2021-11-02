<template>
    <STInputBox title="Wachtwoord sterkte">
        <div class="password-strength">
            <div :style="{ width: strength+'%' }" :class="type" />
        </div>
        <p v-if="!value" class="style-description-small">
            Gebruik bij voorkeur de wachtwoord-beheerder van jouw browser
        </p>
        <p v-else-if="warning.length > 0" class="style-description-small">
            {{ warning }}
        </p>
        <p v-else-if="duration <= 60*60" class="style-description-small">
            Kan in enkele minuten worden geraden door een computer
        </p>
        <p v-else-if="duration <= 60*60*24" class="style-description-small">
            Kan in enkele uren worden geraden door een computer
        </p>
        <p v-else-if="duration <= 60*60*24*30" class="style-description-small">
            Kan in enkele dagen worden geraden door een computer
        </p>
        <p v-else-if="duration <= 60*60*24*30*12" class="style-description-small">
            Kan binnen het jaar worden geraden door een computer
        </p>
        <p v-else class="style-description-small">
            Jouw wachtwoord ziet er goed uit
        </p>

        <span v-if="value" slot="right" :class="type" class="password-strength-description">{{ description }}</span>
    </STInputBox>
</template>

<script lang="ts">
import { STInputBox } from "@stamhoofd/components"
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class PasswordStrength extends Vue {
    @Prop({ default: null })
    value!: string | null

    strength = 0
    duration = 0
    warning = ""

    calculateCounter = 0
    loading = false

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null || val.length == 0) {
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
            if (saved != this.calculateCounter) {
                // skip
                return
            }
            const result = calculator.checkPassword(password)
            if (saved != this.calculateCounter) {
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
        if (strength == 0) {
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
@use "~@stamhoofd/scss/base/variables.scss" as *;

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
            background: $color-gray;
        }

        &.error {
            background: $color-error;
        }

        &.warning {
            background: $color-warning-primary;
        }

        &.success {
            background: $color-success;
        }
    }
}

.password-strength-description {
    font-weight: bold;

    &.none {
        color: $color-gray;
    }

    &.error {
        color: $color-error;
    }

    &.warning {
        color: $color-warning-primary;
    }

    &.success {
        color: $color-success;
    }   
}
</style>
