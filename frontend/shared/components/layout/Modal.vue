<template>
    <transition>
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

<style lang="scss" scoped>
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
    }
</style>