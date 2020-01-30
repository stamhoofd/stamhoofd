<template>
    <transition
        appear
        name="fade"
        mode="out-in"
        v-on:after-enter="afterEnter"
        :modal-type="type"
    >
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
        component: Object,
        type: String
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

