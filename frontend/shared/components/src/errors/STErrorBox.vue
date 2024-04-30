<template>
    <transition
        appear
        name="error-box-transition"
        @before-enter="beforeEnter"
        @enter="enter"
        @after-enter="afterEnter"
        @leave="leave"
    >
        <div>
            <div class="error-box-parent">
                <div class="error-box">
                    <slot />
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({})
export default class STErrorBox extends Vue {
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
    @use '@stamhoofd/scss/base/variables' as *;

    .error-box-transition-enter-active, .error-box-transition-leave-active {
        transition: height 0.2s, opacity 0.2s;

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }

    .error-box-parent > .error-box {
        animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        transform: translate3d(0, 0, 0);
        backface-visibility: hidden;
        perspective: 1000px;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .error-box-parent {
        padding: 5px 0;
    }

    @keyframes shake {
        10%,
        90% {
            transform: translate3d(-1px, 0, 0);
        }

        20%,
        80% {
            transform: translate3d(2px, 0, 0);
        }

        30%,
        50%,
        70% {
            transform: translate3d(-4px, 0, 0);
        }

        40%,
        60% {
            transform: translate3d(4px, 0, 0);
        }
    }
</style>