<template>
    <transition
        appear
        name="error-box-transition"
        @before-enter="beforeEnter"
        @enter="enter"
        @after-enter="afterEnter"
        @leave="leave"
    >
        <div class="error-box-parent">
            <div class="error-box">
                <slot />
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component({})
export default class STErrorsDefault extends Vue {
    beforeEnter(el: HTMLElement) {
        el.style.opacity = "0";
    }

    enter(el: HTMLElement) {
        const height = el.offsetHeight;
        el.style.height = "0";

        requestAnimationFrame(() => {
            el.style.height = height+"px";
            el.style.opacity = "1";
        });

    }

    afterEnter(el: HTMLElement) {
        el.style.height = "";
    }


    leave(el: HTMLElement) {
        const height = el.offsetHeight;
        el.style.height = height+"px";

        requestAnimationFrame(() => {
            el.style.height = "0px";
            el.style.opacity = "0";
        });

    }
}
</script>

<style lang="scss">
    @use "@stamhoofd/scss/components/errors.scss";

    .error-box-transition-enter-active, .error-box-transition-leave-active {
        transition: height 0.2s, opacity 0.2s;

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }
</style>