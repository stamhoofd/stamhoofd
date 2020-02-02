<template>
    <transition appear name="fade">
        <div class="popup" @click="dismiss">
            <div @click.stop="">
                <component
                    :key="component.key"
                    :is="component.component"
                    v-bind="component.properties"
                    @dismiss="dismiss"
                ></component>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

@Component({
    props: {
        component: ComponentWithProperties
    }
})
export default class Popup extends Vue {
    dismiss() {
        this.$emit("remove");
    }
}
</script>

<style lang="scss">
.popup {
        // DO NOT ADD MAX HEIGHT HERE! Always add it to the children of the navigation controllers!
        background: rgba(black, 0.7);
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;

        // Improve performance

        & > div {
            max-width: 800px;
            flex-basis: 100%;
            background: white;
            border-radius: 5px;

            & > * {
                max-height: 100vh;
                max-height: calc(var(--vh, 1vh) * 100);
                overflow: hidden;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior-y: contain;
                transition: width 0.3s, height 0.3s;

                // Remove scroll blinks
                will-change: scroll-position;
            }

            box-sizing: border-box;
        }
    }

    &.fade-enter-active,
    &.fade-leave-active,
    &[data-extended-enter="true"] {
        position: fixed;
        transition: opacity 0.3s;

        & > div {
            transition: opacity 0.3s, transform 0.3s;
        }
    }
    &.fade-enter, &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;

        & > div {
            transform: translate(0, 50vh);
        }
    }

    &.fade-enter-active,
    &.fade-leave-active {
        z-index: 10000;
    }
}
</style>
