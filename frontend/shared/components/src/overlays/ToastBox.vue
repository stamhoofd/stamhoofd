<template>
    <div class="toast-box" :class="{ withOffset: withOffset }" data-testid="toast-box">
        <transition-group name="move" tag="div">
            <div
                v-for="(component, index) in components"
                :key="component.key"
            >
                <ComponentWithPropertiesInstance
                    ref="children"
                    :component="component"
                    :custom-provide="getCustomProvide(index, component.key)"
                />
            </div>
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import type { Ref } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Toast } from './Toast';
import ToastView from './ToastView.vue';

/**
 * This component will automatically show the root if we have a valid token. If the user logs out, we'll automatically show the login view
*/

// Cast away UnwrapRef so the array elements keep their ComponentWithProperties type
const components = ref<ComponentWithProperties[]>([]) as unknown as Ref<ComponentWithProperties[]>;
let lastOffset = false;

// Stable owner reference for Toast listener registration/removal.
const owner = {};

onMounted(() => {
    Toast.addListener(owner, showToast);
});

onBeforeUnmount(() => {
    Toast.removeListener(owner);
    components.value = [];
});

function getCustomProvide(index: number, key: number) {
    return {
        reactive_navigation_pop: () => {
            removeAt(index, key);
        },
        reactive_navigation_dismiss: () => {
            console.warn('Avoid calling dismiss in components on the ToastBox, since options are not supported here');
            removeAt(index, key);
        },
    };
}

function showToast(toast: Toast) {
    show(new ComponentWithProperties(ToastView, { toast }));
}

function show(component: ComponentWithProperties) {
    // Make sure this component is not counted in navigation stuff
    component.modalDisplayStyle = 'overlay';

    // if mobile: add to beginning
    if (document.body.offsetWidth <= 450) {
        components.value.unshift(component);
    } else {
        components.value.push(component);
    }
}

function hide(tag: string) {
    for (const [index, component] of components.value.entries()) {
        if (component.properties.tags && Array.isArray(component.properties.tags) && component.properties.tags.includes(tag)) {
            removeAt(index, component.key);
        }
    }
}

function removeAt(index: number, key: number) {
    if (components.value[index] && components.value[index].key === key) {
        components.value.splice(index, 1);
        return;
    }

    // Search
    for (let i = 0; i < components.value.length; i++) {
        if (components.value[i].key === key) {
            components.value.splice(i, 1);
            return;
        }
    }

    console.warn('Expected component with key ' + key + ' at index' + index);
}

const withOffset = computed(() => {
    if (components.value.length === 0) {
        return lastOffset;
    }

    for (const [, component] of components.value.entries()) {
        if (component.properties.toast && component.properties.toast.withOffset) {
            lastOffset = true;
            return true;
        }
    }
    lastOffset = false;
    return false;
});

defineExpose({ hide, show });
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.toast-box {
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 10001;
    overflow: visible;
    padding: 0 10px;
    pointer-events:none;
    width: 450px;
    padding-bottom: 0;
    padding-top: calc(10px + var(--st-safe-area-top, 0px));

    @media (max-width: 550px) {
        padding: 0 5px;
        width: 100%;
    }

    max-width: 100vw;
    box-sizing: border-box;
    transition: transform 0.3s;

    transform: translateY(
        calc(
            -5px
            - max(
                var(--st-safe-area-bottom, 0px),
                var(--keyboard-height, 0px)
            )
        )
    );

    &.withOffset {
        transform: translateY(calc(-70px - max(var(--st-safe-area-bottom, 0px), var(--bottom-padding, 0px), var(--keyboard-height, 0px)) + var(--bottom-padding, 0px)));
    }

    > div > div {
        transition: transform 0.35s, opacity 0.35s;
        transform: scale(1, 1) translate(0, 0);
        cursor: pointer;
        touch-action: manipulation;

        &:hover:not(:has(button:hover)):not(:has(a:hover)) {
            transform: scale(0.98, 0.98) translateY(5px);
            opacity: 0.8;
        }
    }

    .move-enter-from, .move-leave-to
        /* .list-complete-leave-active below version 2.1.8 */ {
        opacity: 0;
        transform: scale(0.9, 0.9) translateY(100%);
        transform-origin: center center;
    }

    .move-leave-active {
        height: 0;
        z-index: -10;
        pointer-events: none;
    }
}
</style>
