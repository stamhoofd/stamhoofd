<template>
    <div v-if="visible" ref="el" class="container">
        <slot />
    </div>
</template>


<script lang="ts" setup>
import { nextTick, ref, watch } from 'vue';
import { ViewportHelper } from '../ViewportHelper';

const props = withDefaults(
    defineProps<{
        visible?: boolean
    }>(),
    {
        visible: false
    }
);

const el = ref<HTMLElement|null>(null);

// Scroll to the container if it becomes visible
watch(() => props.visible, async (newValue, oldValue) => {
    await nextTick();

    // Need a small delay because of the ImageComponent component which needs to calculate the width of the image after initial render
    setTimeout(() => {
        if (newValue && !oldValue) {
            console.log("Scrolling to element", el.value);
            const element = el.value;
            if (element) {
                ViewportHelper.scrollIntoView(element)

                // Focus
                setTimeout(() => {
                    const firstInputElement: HTMLInputElement|null = element.querySelector("input, textarea");
                    if (firstInputElement && firstInputElement.type !== 'file') {
                        firstInputElement.focus();
                    }
                }, 200)
            }
        }
    }, 25);
});

</script>
