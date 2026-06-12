<template>
    <STInputBox :title="$t(`%db`)">
        <div class="password-strength">
            <div :style="{ width: strength+'%' }" :class="type" />
        </div>
        <p v-if="!model" class="style-description-small">
            {{ $t('%dV') }}
        </p>
        <p v-else-if="warning.length > 0" class="style-description-small">
            {{ warning }}
        </p>
        <p v-else-if="duration <= 60*60" class="style-description-small">
            {{ $t('%dW') }}
        </p>
        <p v-else-if="duration <= 60*60*24" class="style-description-small">
            {{ $t('%dX') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30" class="style-description-small">
            {{ $t('%dY') }}
        </p>
        <p v-else-if="duration <= 60*60*24*30*12" class="style-description-small">
            {{ $t('%dZ') }}
        </p>
        <p v-else class="style-description-small">
            {{ $t('%da') }}
        </p>

        <template #right>
            <span v-if="model" :class="type" class="password-strength-description">{{ description }}</span>
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import STInputBox from './STInputBox.vue';

const model = defineModel<string | null>({ default: null });

const strength = ref(0);
const duration = ref(0);
const warning = ref('');

let calculateCounter = 0;
const loading = ref(false);

watch(model, (val) => {
    if (val === null || val.length === 0) {
        calculateCounter++;
        strength.value = 0;
        duration.value = 0;
        loading.value = false;
        return;
    }
    calculateStrength(val).catch((e) => {
        console.error(e);
    });
});

async function calculateStrength(password: string) {
    calculateCounter++;
    const saved = calculateCounter;
    loading.value = true;

    try {
        const calculator = await import(/* webpackChunkName: "PasswordStrengthCalculator" */ './PasswordStrengthCalculator');
        if (saved !== calculateCounter) {
            // skip
            return;
        }
        const result = calculator.checkPassword(password);
        if (saved !== calculateCounter) {
            // skip
            return;
        }
        warning.value = result.feedback.warning ?? '';
        strength.value = result.score * 25;
        duration.value = result.crackTimesSeconds.offlineSlowHashing1e4PerSecond;
    }
    catch (e) {
        // ignore
    }

    if (saved === calculateCounter) {
        loading.value = false;
    }
}

const type = computed(() => {
    if (strength.value === 0) {
        return 'none';
    }

    if (strength.value < 50) {
        return 'error';
    }

    if (strength.value < 100) {
        return 'warning';
    }

    return 'success';
});

const description = computed(() => {
    if (strength.value < 50) {
        return $t(`%z7`);
    }

    if (strength.value < 75) {
        return $t(`%z8`);
    }

    if (strength.value < 100) {
        return $t(`%z9`);
    }

    return $t(`%zA`);
});
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
