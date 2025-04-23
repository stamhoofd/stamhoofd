<template>
    <STInputBox :title="$t(`f45010df-47d0-4a9c-8da9-0c1d94e1154a`)">
        <div class="password-strength">
            <div :style="{ width: strength+'%' }" :class="type" />
        </div>
        <p v-if="!modelValue" class="style-description-small">
            {{ $t('7664f47d-225d-46f2-83d7-f96447a87ebc') }}
        </p>
        <p v-else-if="warning.length > 0" class="style-description-small">
            {{ warning }}
        </p>
        <p v-else-if="duration <= 60*60" class="style-description-small">
            {{ $t('472aad06-aa6e-41d9-8cc9-9cd6bc655a70') }}
        </p>
        <p v-else-if="duration <= 60*60*24" class="style-description-small">
            {{ $t('aac87352-9ee9-4d8e-a49d-442426e1d75d') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30" class="style-description-small">
            {{ $t('78c8c642-1036-48db-8f21-592ca3efc29a') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30*12" class="style-description-small">
            {{ $t('8d24cecf-ab4b-485c-90e0-b6b14b418fd8') }}
        </p>
        <p v-else class="style-description-small">
            {{ $t('780337a3-ce5b-4071-b53f-465e7e55ad65') }}
        </p>

        <template #right>
            <span v-if="modelValue" :class="type" class="password-strength-description">{{ description }}</span>
        </template>
    </STInputBox>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
    },
})
export default class PasswordStrength extends VueComponent {
    @Prop({ default: null })
    modelValue!: string | null;

    strength = 0;
    duration = 0;
    warning = '';

    calculateCounter = 0;
    loading = false;

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null || val.length === 0) {
            this.calculateCounter++;
            this.strength = 0;
            this.duration = 0;
            this.loading = false;
            return;
        }
        this.calculateStrength(val).catch((e) => {
            console.error(e);
        });
    }

    async calculateStrength(password: string) {
        this.calculateCounter++;
        const saved = this.calculateCounter;
        this.loading = true;

        try {
            const calculator = await import(/* webpackChunkName: "PasswordStrengthCalculator" */ './PasswordStrengthCalculator');
            if (saved !== this.calculateCounter) {
                // skip
                return;
            }
            const result = calculator.checkPassword(password);
            if (saved !== this.calculateCounter) {
                // skip
                return;
            }
            this.warning = result.feedback.warning ?? '';
            this.strength = result.score * 25;
            this.duration = result.crackTimesSeconds.offlineSlowHashing1e4PerSecond;
        }
        catch (e) {
            // ignore
        }

        if (saved === this.calculateCounter) {
            this.loading = false;
        }
    }

    get type() {
        const strength = this.strength;
        if (strength === 0) {
            return 'none';
        }

        if (strength < 50) {
            return 'error';
        }

        if (strength < 100) {
            return 'warning';
        }

        return 'success';
    }

    get description() {
        const strength = this.strength;
        if (strength < 50) {
            return $t(`a5feaa9e-0e9f-42f3-9ebc-5c536ecfdebc`);
        }

        if (strength < 75) {
            return $t(`702a8908-fe5d-4c0f-a24f-cef7694a4b37`);
        }

        if (strength < 100) {
            return $t(`b43451f9-127b-4cb5-8310-e5c85936567f`);
        }

        return $t(`fee65508-7b87-4db2-a56f-457cd3e7d808`);
    }

    get detailDescription() {
        if (this.warning.length > 0) {
            return this.warning;
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
