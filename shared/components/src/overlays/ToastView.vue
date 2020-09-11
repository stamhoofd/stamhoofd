<template>
    <div class="toast-view-container">
        <div class="toast-view" @click="close" :class="toast.icon">
            <div class="progress" v-if="toast.progress !== null" :style="{ width: toast.progress * 100 + '%' }" :class="{ hide: toast.progress >= 1 }" />
            <Spinner v-if="toast.icon == 'spinner'"/>
            <span v-else-if="toast.icon" class="icon" :class="toast.icon"/>
            <span>{{ message }}</span>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin, FramedComponent } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Mixins } from "vue-property-decorator";
import { Toast } from './Toast';
import Spinner from '../Spinner.vue';

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

    close() {
        if (this.onClose && !this.isClosing) {
            this.onClose();
        }
        this.isClosing = true
        this.emitParents("pop", undefined);
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles' as *;

.toast-view-container {
    padding: 10px 0;
}

.toast-view {
    touch-action: manipulation;
    user-select: none;
    cursor: pointer;
    padding: 15px 30px;
    width: 350px;
    max-width: 100%;

    @media (max-width: 450px) {
        padding: 15px 20px;
    }

    box-sizing: border-box;
    @extend .style-input-shadow;
    background: $color-primary-light;
    border-radius: $border-radius;
    pointer-events:all;   

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;

    font-size: 16px;
    line-height: 1.4;
    font-weight: 600;
    color: $color-dark;
    position: relative;
    overflow: hidden;

    .progress {
        position: absolute;
        left: 0;
        top: 0;
        height: $border-width;
        pointer-events: none;
        background: $color-primary;
        border-top-right-radius: $border-width/2;
        border-bottom-right-radius: $border-width/2;
        width: 0;
        opacity: 1;
        transition: width 0.3s, opacity 0.3s;

        &.hide {
            transition: width 0.3s, opacity 0.2s 0.3s;
            opacity: 0;
        }
    }

    .icon {
        color: $color-primary;
        margin-left: -10px;
        margin-right: 10px;
        flex-shrink: 0;
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

    &> .spinner-container {
        margin-right: 75px - 30px - 28px;
    }
}
</style>