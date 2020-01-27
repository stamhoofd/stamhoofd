<template>
    <transition appear name="fade" mode="out-in">
        <div class="modal" @click="dismiss">
            <div @click.stop="">
                <component :key="component.key" :is="component.component" v-bind="component.properties"></component>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

@Component({
    props: {
        "component": Object
    }
})
export default class Modal extends Vue {
    dismiss() {
        this.$emit("remove");
    }

}
</script>

<style lang="scss">
    .modal {
        background: rgba(black, 0.5);
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;

        &> div {
            max-width: 900px;
            flex-basis: 100%;
            background: white;
            border-radius: 5px;
        }

        &.fade-enter-active, &.fade-leave-active {
            transition: opacity 0.3s;

            &> div {
                transition: opacity 0.3s, transform 0.3s;
            }
        }
        &.fade-enter, &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
            opacity: 0;

            &> div {
                transform: translate(0, 50vh);
            }
        }
    }
</style>