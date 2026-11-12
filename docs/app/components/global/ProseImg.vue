<template>
    <UModal
        v-if="zoom"
        :title="title"
        :transition="false"
        :ui="{
            overlay: ['docs-image-overlay', ui?.overlay].filter(Boolean).join(' '),
            content: ['docs-image-dialog', ui?.content].filter(Boolean).join(' '),
        }"
    >
        <button
            type="button"
            class="docs-image-trigger"
            :aria-label="alt ? `Afbeelding vergroten: ${alt}` : 'Afbeelding vergroten'"
        >
            <NuxtImg
                v-bind="$attrs"
                :src="src"
                :alt="alt"
                :width="width"
                :height="height"
                :class="['docs-image', props.class, ui?.base]"
            />
        </button>

        <template #content="{ close }">
            <button type="button" class="docs-image-close" @click="close">
                Sluiten
            </button>
            <!-- Original dimensions avoid thumbnail upscaling; the viewport only limits display size. -->
            <NuxtImg
                v-bind="$attrs"
                :src="src"
                :alt="alt"
                :width="undefined"
                :height="undefined"
                :sizes="undefined"
                :srcset="undefined"
                densities="1x"
                :quality="100"
                loading="eager"
                :class="['docs-image-zoomed', ui?.zoomedImage]"
                @click="close"
            />
        </template>
    </UModal>
    <NuxtImg
        v-else
        v-bind="$attrs"
        :src="src"
        :alt="alt"
        :width="width"
        :height="height"
        :class="['docs-image', props.class, ui?.base]"
    />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { resolveBaseURL } from '#ui/utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
    src: string;
    alt: string;
    width?: string | number;
    height?: string | number;
    zoom?: boolean;
    class?: HTMLAttributes['class'];
    ui?: {
        base?: string;
        overlay?: string;
        content?: string;
        zoomedImage?: string;
    };
}>(), { zoom: true });

const runtimeConfig = useRuntimeConfig();
const src = computed(() => resolveBaseURL(props.src, runtimeConfig.app.baseURL));
const title = computed(() => props.alt ? `Vergrote afbeelding: ${props.alt}` : 'Vergrote afbeelding');
</script>

<style>
.docs-image-trigger {
    display: block;
    width: fit-content;
    max-width: 100%;
    margin: 25px 0;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    cursor: zoom-in;
}

.docs-image-trigger > .docs-image {
    margin: 0;
}

.docs-image {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 5px;
}

.docs-image-trigger:focus-visible,
.docs-image-close:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 4px;
}

.docs-image-overlay {
    background: rgb(0 0 0 / 75%);
}

.docs-image-dialog {
    width: fit-content;
    max-width: 95vw;
    max-height: 95vh;
    overflow: visible;
    border-radius: 5px;
    background: transparent;
    box-shadow: none;
}

.docs-image-zoomed {
    display: block;
    width: auto;
    height: auto;
    max-width: 95vw;
    max-height: 95vh;
    border-radius: 5px;
    object-fit: contain;
    cursor: zoom-out;
}

.docs-image-close {
    position: absolute;
    top: 8px;
    right: 8px;
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid var(--ui-border);
    border-radius: 9px;
    background: var(--ui-bg);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
}
</style>
