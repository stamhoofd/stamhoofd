<template>
    <div class="toast-view-container">
        <div class="toast-view" @click="close" :class="toast.icon">
            <Spinner v-if="toast.icon == 'spinner'"/>
            <span v-if="toast.icon" class="icon" :class="toast.icon"/>
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

    font-size: 16px;
    line-height: 1.4;
    font-weight: 600;
    color: $color-dark;

    .icon {
        color: $color-primary;
        margin-left: -10px;
        margin-right: 10px;
        flex-shrink: 0;
    }

    &.green {
        background-color: $color-success-background;
        color: $color-success-dark;
    }

    &.red {
        background-color: $color-error-background;
        color: $color-error-dark;;
    }

    &> .spinner-container {
        margin-right: 75px - 30px - 28px;
    }
}
</style>