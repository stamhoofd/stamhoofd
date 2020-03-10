<template>
    <transition appear name="fade">
        <div class="popup" @mousedown="pop" @touchdown="pop">
            <div @mousedown.stop="" @touchdown.stop="">
                <component :key="root.key" :is="root.component" v-bind="root.properties" @pop="pop"></component>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import { NavigationMixin } from "../../classes/NavigationMixin";

@Component({
    props: {
        root: ComponentWithProperties
    }
})
export default class Popup extends NavigationMixin {
    activated() {
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        var key = event.key || event.keyCode;

        if (key === "Escape" || key === "Esc" || key === 27) {
            this.pop();
            event.preventDefault();
        }
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

        // Rounded corners need overflow hidden on scroll
        overflow: hidden;

        max-height: 100vh;
        max-height: calc(var(--vh, 1vh) * 100);
        height: calc(var(--vh, 1vh) * 100 - 80px);

        overflow: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;

        box-sizing: border-box;

        --saved-vh: var(--vh, 1vh);

        > * {
            // Pass updated vh to children
            --vh: calc(var(--saved-vh, 1vh) - 0.8px);
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
