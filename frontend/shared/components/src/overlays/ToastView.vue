<template>
    <div class="toast-view-container">
        <component :is="!toast.button || !toast.forceButtonClick ? 'div' : (toast.button.href ? 'a' : 'button')" class="toast-view" :class="(toast.icon ?? '') + (toast.button && toast.forceButtonClick ? ' button' : '')" :href="toast.forceButtonClick ? (toast.button?.href ?? undefined) : undefined" :download="toast.forceButtonClick ? (toast.button?.download ?? undefined) : undefined" :data-testid="toast.testId" @click="clicked" @mousedown.prevent>
            <div v-if="toast.progress !== null" class="progress" :style="{ width: toast.progress * 100 + '%' }" :class="{ hide: toast.progress >= 1 }" />
            <Spinner v-if="toast.icon === 'spinner'" />
            <span v-else-if="toast.icon" class="first icon" :class="toast.icon" />
            <div>
                <div>{{ message }}</div>
                <component :is="toast.forceButtonClick ? 'span' : (toast.button.href ? 'a' : 'button')" v-if="toast.button" :href="toast.button.href ?? undefined" :download="toast.button.download ?? undefined" class="button text increase-click-area" type="button" @click.stop="clickedButton">
                    <span v-if="toast.button.icon" :class="'icon ' + toast.button.icon" />
                    <span>{{ toast.button.text }}</span>
                </component>
            </div>
            <span v-if="toast.action" class="icon arrow-right" />
        </component>
    </div>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { computed, onMounted, ref } from 'vue';

import Spinner from '../Spinner.vue';
import type { Toast } from './Toast';

/**
 * This component will automatically show the root if we have a valid token. If the user logs out, we'll automatically show the login view
*/

const props = withDefaults(defineProps<{
    toast: Toast;
    onClose?: (() => void) | null;
}>(), {
    onClose: null,
});

const pop = usePop();

const message = computed(() => props.toast.message);
const isClosing = ref(false);

onMounted(() => {
    if (props.toast.autohideAfter) {
        window.setTimeout(() => {
            close().catch(console.error);
        }, props.toast.autohideAfter);
    }
    props.toast.doHide = () => {
        close().catch(console.error);
    };
});

async function clicked() {
    if (props.toast.forceButtonClick) {
        return clickedButton();
    }

    await close();

    if (props.toast.action) {
        props.toast.action();
    }
}

async function close() {
    if (props.onClose && !isClosing.value) {
        props.onClose();
    }
    isClosing.value = true;
    await pop();
}

async function clickedButton() {
    props.toast.button!.action();
    await close();
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.toast-view-container {
    padding: 5px 0;

    @media (max-width: 550px) {
        padding: 2.5px 0;
    }
}

.toast-view {
    touch-action: manipulation;
    user-select: none;
    cursor: pointer;
    padding: 15px;
    width: 450px;
    max-width: 100%;

    @media (max-width: 550px) {
        padding: 15px 10px;
        width: 100%;
    }

    box-sizing: border-box;
    @extend %style-input-shadow;
    background: $color-primary-background;
    border-radius: $border-radius-modals;
    pointer-events:all;

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;

    font-size: 16px;
    line-height: 1.4;
    font-weight: $font-weight-semibold;
    color: $color-primary;

    @media (max-width: 700px) {
        font-size: 14px;
    }

    div, .icon.dark {
        color: $color-dark;
    }

    position: relative;
    overflow: hidden;

    .progress {
        position: absolute;
        left: 0;
        top: 0;
        height: 2px;
        pointer-events: none;
        background: $color-primary;
        border-top-right-radius: 1px;
        border-bottom-right-radius: 1px;
        width: 0;
        opacity: 1;
        transition: width 0.3s, opacity 0.3s;

        &.hide {
            transition: width 0.3s, opacity 0.2s 0.3s;
            opacity: 0;
        }
    }

    .icon {
        flex-shrink: 0;
    }

    .icon.first {
        margin-left: 5px;
        margin-right: 15px;

        @media (max-width: 700px) {
            margin-left: 0px;
            margin-right: 10px;
        }
    }

    &.green {
        background-color: $color-success-background;
        color: $color-success-dark;

        .progress {
            background: $color-success;
        }
    }

    &.red {
        background-color: $color-error-background;
        color: $color-error-dark;;

        .progress {
            background: $color-error;
        }
    }

    &.yellow {
        background-color: $color-warning-background;
        color: $color-warning-dark;;

        .progress {
            background: $color-warning;
        }

        .button {
            color: $color-warning-dark;
        }
    }

    &.button {
        &:hover {
            background: $color-primary-light;

            .button:hover {
                opacity: 1;
            }
        }
    }
    &> .spinner-container {
        margin-right: 75px - 30px - 28px;
    }

    .button {
        margin-top: 5px;
    }
}
</style>
