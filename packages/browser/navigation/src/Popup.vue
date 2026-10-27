<!-- eslint-disable vue/require-toggle-inside-transition -->
<template>
    <div :class="buildClass" :style="style" :inert="pushDown > 0" @click="onClick">
        <div ref="mainContent">
            <div class="scrollable-container">
                <ComponentWithPropertiesInstance :key="root.key" :component="root" />
            </div>
        </div>
        <div class="background" />
    </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onActivated, onDeactivated, provide, ref, shallowRef } from 'vue';

import { type ComponentWithProperties, getExposeProxy, useCurrentComponent } from './ComponentWithProperties';
import ComponentWithPropertiesInstance from './ComponentWithPropertiesInstance.js';
import type { PopOptions } from './PopOptions';
import { useFocused, usePop } from './utils/navigationHooks';
import { useModalStackComponent } from './utils/useModalStackComponent.js';

// Self reference
const instance = getCurrentInstance();
const Popup = instance!.type;

const props = withDefaults(
    defineProps<{
        root: ComponentWithProperties;
        className: string;
        style: string | Record<string, string>;
    }>(),
    {
        className: 'popup',
        style: '',
    },
);
const hide = ref(false);

// ComponentWithProperties is never reactive, so we don't need computed
const modalStackComponent = useModalStackComponent();
const pop = usePop();
const mainContent = ref<HTMLElement | null>(null);
const component = useCurrentComponent();

provide('reactive_navigation_dismiss', async (options?: PopOptions) => {
    // This adds shouldNavigateAway behaviour
    return await dismiss(options);
});

provide('reactive_navigation_pop', async (options?: PopOptions) => {
    // If there are no navigationControllers
    console.warn('Using .pop() inside a Popup without a NavigationController dismisses the Popup. It is recommended to use .dismiss() instead.');
    return await dismiss(options);
});

provide('reactive_navigation_can_pop', false);
provide('reactive_navigation_can_dismiss', true);
provide('reactive_popup', computed(() => getExposeProxy(instance)));

const pushDown = computed(() => {
    const popups = modalStackComponent.value?.stackComponent?.children.filter((c: ComponentWithProperties) => c.component === Popup && (c.properties.className ?? 'popup') === (props.className ?? 'popup') && !c.isDismissing.value) ?? [];
    if (popups.length > 0 && popups[popups.length - 1] !== component) {
        if (popups.length > 1 && popups[popups.length - 2] === component) {
            return 1;
        }
        return 2;
    }
    return 0;
});

const buildClass = computed(() => {
    const vvv = { 'push-down': pushDown.value == 1, 'push-down-full': pushDown.value > 1 };
    const j = Object.keys(vvv).filter(p => !!(vvv as any)[p]).join(' ');
    return j + (j ? ' ' : '') + (props.className ? props.className : 'popup') + (props.root.animated ? ' animated' : '') + (isFocused.value ? ' focused' : '');
});

const isFocused = useFocused();

const onKey = (event: { defaultPrevented: any; repeat: any; key: any; keyCode: any; preventDefault: () => void }) => {
    if (event.defaultPrevented || event.repeat) {
        return;
    }

    if (!isFocused.value) {
        return;
    }

    const key = event.key || event.keyCode;

    if (key === 'Escape' || key === 'Esc' || key === 27) {
        dismiss().catch(console.error);
        event.preventDefault();
    }
};

const shouldNavigateAway = () => {
    return props.root.shouldNavigateAway();
};

const dismiss = async (options?: PopOptions) => {
    if (hide.value) {
        return;
    }

    if (!options?.force) {
        const r = await shouldNavigateAway();
        if (!r) {
            return false;
        }
    }

    // Let everyone know they should ignore us for now
    component!.isDismissing.value = true;
    pop(options)?.catch(console.error);
};

const onClick = (event: MouseEvent) => {
    // Check click is inside mainContent
    if (mainContent.value && event.target && !mainContent.value.contains(event.target as any) && ((event.target as any).isConnected || document.body.contains(event.target as any))) {
        dismiss().catch(console.error);
        event.preventDefault();
    }
};

onActivated(() => {
    document.addEventListener('keydown', onKey);
});

onDeactivated(() => {
    document.removeEventListener('keydown', onKey);
});
defineExpose({
    dismiss: shallowRef(dismiss),
    pop: shallowRef(dismiss),
});
</script>
