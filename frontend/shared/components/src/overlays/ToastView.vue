<template>
    <div class="toast-view-container">
        <div class="toast-view" :class="toast.icon" @click="clicked" @mousedown.prevent>
            <div v-if="toast.progress !== null" class="progress" :style="{ width: toast.progress * 100 + '%' }" :class="{ hide: toast.progress >= 1 }" />
            <Spinner v-if="toast.icon == 'spinner'" />
            <span v-else-if="toast.icon" class="first icon" :class="toast.icon" />
            <div>
                <div>{{ message }}</div>
                <button v-if="toast.button" class="button text increase-click-area" type="button" @click.stop="clickedButton">
                    {{ toast.button.text }}
                </button>
            </div>
            <span v-if="toast.action" class="icon arrow-right" />
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import Spinner from '../Spinner.vue';
import { Toast } from './Toast';

/**
 * This component will automatically show the root if we have a valid token. If the user logs out, we'll automatically show the login view
*/
@Component({
    components: {
        Spinner
    }
})
export default class ToastView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        toast: Toast

    get message() {
        return this.toast.message
    }

    isClosing = false

    @Prop({default: null})
        onClose: (() => void) | null

    mounted() {
        if (this.toast.autohideAfter) {
            window.setTimeout(() => {
                this.close();
            }, this.toast.autohideAfter)
        }
        this.toast.doHide = () => {
            this.close()
        }
    }

    clicked() {
        this.close();
        if (this.toast.action) {
            this.toast.action()
        }
    }

    close() {
        if (this.onClose && !this.isClosing) {
            this.onClose();
        }
        this.isClosing = true
        this.pop();
    }

    clickedButton() {
        this.toast.button!.action()
        this.close()
    }
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
    @extend .style-input-shadow;
    background: $color-primary-light;
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


    &> .spinner-container {
        margin-right: 75px - 30px - 28px;
    }

    .button {
        margin-top: 5px;
    }
}
</style>
