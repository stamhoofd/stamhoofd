<template>
    <transition appear name="fade" mode="out-in" v-on:after-enter="afterEnter">
        <div class="modal" @click="dismiss">
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

@Component({
    props: {
        component: Object
    }
})
export default class Modal extends Vue {
    dismiss() {
        this.$emit("remove");
    }
    afterEnter() {
        // Remove body
        this.$emit("hide-others");
    }
}
</script>

<style lang="scss">
.modal {
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

    & > div {
        max-width: 800px;
        flex-basis: 100%;
        background: white;
        border-radius: 5px;

        max-height: 100vh;
        overflow-y: auto;
        box-sizing: border-box;
    }

    &.fade-enter-active,
    &.fade-leave-active {
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

    @media (max-width: 500px) {
        padding: 0px;
        display: block;
        bottom: auto;
        position: relative;
        background: white;

        &.fade-enter-active,
        &.fade-leave-active {
            position: fixed;
        }

        & > div {
            border-radius: 0;

            max-width: none;
            max-height: none;
            width: 100%;
            height: 100%;

            & > .navigation-controller {
                width: 100% !important;
            }
        }
    }
}
</style>
