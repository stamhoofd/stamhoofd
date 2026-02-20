<template>
    <transition
        appear
        name="error-box-transition"
        :duration="10000"
        @before-enter="beforeEnter as any"
        @enter="enter as any"
        @after-enter="afterEnter as any"
        @leave="leave as any"
    >
        <div>
            <div class="error-box-parent">
                <div ref="error-box" class="error-box">
                    {{ errorMessage }}
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { computed, useTemplateRef, watch } from 'vue';
import { Request } from '@simonbackx/simple-networking';

const props = defineProps<{
    error: SimpleError;
}>();

const errorBoxElement = useTemplateRef('error-box');

const errorMessage = computed(() => {
    if (Request.isNetworkError(props.error)) {
        return $t(`94bdc2a4-9ebb-42d2-a4e9-d674eb9aafef`);
    }
    return props.error.getHuman();
});

function beforeEnter(el: HTMLElement) {
    el.style.opacity = '0';
}

function enter(el: HTMLElement) {
    const height = el.offsetHeight;
    el.style.height = '0';

    requestAnimationFrame(() => {
        el.style.height = height + 'px';
        el.style.opacity = '1';
    });
}

function afterEnter(el: HTMLElement) {
    el.style.height = '';
}

function leave(el: HTMLElement) {
    const height = el.offsetHeight;
    el.style.height = height + 'px';

    requestAnimationFrame(() => {
        el.style.height = '0px';
        el.style.opacity = '0';
    });
}

function replay() {
    const el = errorBoxElement.value;
    if (el) {
        // Get all animations currently applied to the element
        const animations = el.getAnimations();

        if (animations.length > 0) {
            // Reset the first animation to the beginning and play it
            animations[0].currentTime = 0;
            animations[0].play();
        }
    }
}

watch(() => props.error.id, () => {
    console.log('error id changed', props.error.id);
    replay();
});
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
