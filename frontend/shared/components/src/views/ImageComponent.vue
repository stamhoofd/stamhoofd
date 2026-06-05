<template>
    <div ref="el" class="image-component" :style="{maxHeight: maxHeight ? maxHeight+'px' : undefined}">
        <div v-if="autoHeight" class="sizer" :style="sizerStyle">
            <div :style="sizerChildStyle" />
        </div>

        <picture v-if="elWidth">
            <source
                v-if="imageDark && srcDark && (darkMode === 'Auto' || darkMode === 'On')"
                :srcset="srcDark"
                :media="darkMode === 'Auto' ? '(prefers-color-scheme: dark)' : ''"
                :width="imgWidthDark"
                :height="imgHeightDark"
            >
            <img
                :src="src"
                :width="imgWidth"
                :height="imgHeight"
                :alt="alt"
            >
        </picture>
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import type { Image } from '@stamhoofd/structures';
import { DarkMode } from '@stamhoofd/structures';

const props = withDefaults(defineProps<{
    alt?: string;
    image: Image;
    imageDark?: Image | null;
    darkMode?: DarkMode;
    autoHeight?: boolean;
    maxHeight?: number | null;
}>(), {
    alt: '',
    imageDark: null,
    darkMode: DarkMode.Auto,
    autoHeight: false,
    maxHeight: null,
});

const el = useTemplateRef<HTMLElement>('el');
const elWidth = ref<number | null>(null);
const elHeight = ref<number | null>(null);

const resolution = computed(() => props.image.getResolutionForSize(elWidth.value ?? undefined, elHeight.value ?? undefined));
const darkResolution = computed(() => (props.imageDark ?? props.image).getResolutionForSize(elWidth.value ?? undefined, elHeight.value ?? undefined));

const imgWidth = computed(() => resolution.value.width);
const imgHeight = computed(() => resolution.value.height);
const src = computed(() => resolution.value.file.getPublicPath());

const imgWidthDark = computed(() => darkResolution.value.width);
const imgHeightDark = computed(() => darkResolution.value.height);
const srcDark = computed(() => darkResolution.value.file.getPublicPath());

const sizerChildStyle = computed(() => {
    if (!props.autoHeight) return;
    const percentage = (imgHeight.value / imgWidth.value * 100).toFixed(2);
    return `padding-bottom: ${percentage}%;`;
});

const sizerStyle = computed(() => {
    if (!props.autoHeight) return;
    return `max-height: ${imgHeight.value}px;`;
});

function updateSize() {
    if (!el.value) return;
    elWidth.value = el.value.offsetWidth;
    elHeight.value = props.autoHeight ? null : el.value.offsetHeight;
}

onMounted(() => {
    if (!el.value) return;

    try {
        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });
        resizeObserver.observe(el.value);
    }
    catch (e) {
        updateSize();
    }
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.image-component {
    position: relative;
    overflow: hidden;

    // Width and height should be set by the parent.
    img {
        object-fit: scale-down;
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }
}
</style>
