<template>
    <div v-if="images.length > 0" class="image-gallery">
        <div
            ref="imagesContainer"
            class="image-gallery-images"
            @pointerdown="stopAutomatedScroll"
            @wheel.passive="stopAutomatedScroll"
        >
            <figure
                v-for="image, index in images"
                :key="index"
                ref="imageBoxes"
                class="image-box"
            >
                <ImageComponent :image="image" :auto-height="true" :loading="index > 0 ? 'lazy' : null" />
            </figure>
        </div>
        <div v-if="images.length > 1" class="image-gallery-actions">
            <div class="thumbnails-container">
                <div class="thumbnails">
                    <div
                        v-for="image, index in images"
                        :key="index"
                        ref="thumbnails"
                        :class="['thumbnail', currentImage === index ? 'active' : '']"
                        @click="currentImage = index"
                    >
                        <ImageComponent :image="image" :loading="index > 4 ? 'lazy' : null" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { Image } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';
import ImageComponent from '#views/ImageComponent.vue';
import { ViewportHelper } from '#ViewportHelper.ts';
import { useScrollListener } from '#hooks/useScrollListener.ts';
import { realThrottle } from '@stamhoofd/utility';

const props = withDefaults(defineProps<{
    images: Image[];
}>(), {
    images: () => [],
});

const imageResolutions = computed(() => props.images.map(i => i.getResolutionForSize(600, undefined)));
const imagesSrc = computed(() => imageResolutions.value.map(i => i.file.getPublicPath()));
const currentImage = ref(0);
const imagesContainer = ref<HTMLElement>();
const imageBoxes = ref<HTMLElement[]>();
const thumbnails = ref<HTMLElement[]>();
let updatingCurrentImageFromScroll = false;
let automatedScrollTarget: number | null = null;

function stopAutomatedScroll() {
    automatedScrollTarget = null;
}

watch(currentImage, (index, old) => {
    if (!updatingCurrentImageFromScroll && imageBoxes.value && imagesContainer.value) {
        automatedScrollTarget = index;
        const offset = imageBoxes.value[currentImage.value]?.offsetLeft ?? 0;
        imagesContainer.value.scroll({
            left: offset,
            behavior: 'smooth',
        });
    }

    if (old !== index && thumbnails.value) {
        // Scroll to
        if (index === -1) {
            return;
        }
        const el = thumbnails.value[index];
        if (el) {
            ViewportHelper.scrollXIntoView(el, 'center', false);
        }
    }
}, { flush: 'sync' });

let tick = false;
function updateVisible() {
    // Prevent multiple updates in the same frame
    if (tick) {
        return;
    }
    tick = true;
    requestAnimationFrame(() => {
        tick = false;
        const scrollEl = imagesContainer.value;
        if (!scrollEl) {
            return;
        }

        const scrollRect = scrollEl.getBoundingClientRect();

        let leftPadding = parseInt(window.getComputedStyle(scrollEl, null).getPropertyValue('padding-left'));
        if (isNaN(leftPadding)) {
            leftPadding = 0;
        }

        let rightPadding = parseInt(window.getComputedStyle(scrollEl, null).getPropertyValue('padding-right'));
        if (isNaN(rightPadding)) {
            rightPadding = 0;
        }

        const visibleLeft = scrollRect.left + leftPadding;
        const visibleRight = scrollRect.right - rightPadding;
        let visibleIndex = -1;
        let visibleWidth = 0;

        for (const [index, imageBox] of (imageBoxes.value ?? []).entries()) {
            const rect = imageBox.getBoundingClientRect();
            const width = Math.max(0, Math.min(rect.right, visibleRight) - Math.max(rect.left, visibleLeft));
            if (width > visibleWidth) {
                visibleIndex = index;
                visibleWidth = width;
            }
        }

        if (automatedScrollTarget !== null) {
            if (visibleIndex === automatedScrollTarget) {
                automatedScrollTarget = null;
            }
            return;
        }

        if (visibleIndex !== -1 && visibleIndex !== currentImage.value) {
            updatingCurrentImageFromScroll = true;
            currentImage.value = visibleIndex;
            updatingCurrentImageFromScroll = false;
        }
    });
}
const throttledUpdateVisible = realThrottle(updateVisible, 80);
useScrollListener(computed(() => imagesContainer.value ?? null), () => {
    throttledUpdateVisible();
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.image-gallery {
    .image-gallery-images {
        position: relative;
        overflow: hidden;
        overflow-x: auto;
        scroll-snap-type: x mandatory;

        display: flex;
        align-items: center;
        flex-direction: row;
        gap: 15px;
        width: 100%;

        /* Firefox */
        scrollbar-width: none;

        /* IE / old Edge */
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
            display: none;
        }

        .image-box {
            min-width: 100%;
            border-radius: $border-radius;
            scroll-snap-align: center;

            .image-component {
                width: 100%;
                max-height: 60vh;

                > .sizer {
                    width: 100%;
                }

                img {
                    max-height: 60vh;
                }
            }

            > div {
                display: flex;
                flex-direction: row;
                justify-content: center;
            }

            img {
                height: auto;
                max-width: 100%;
                border-radius: $border-radius;
            }
        }
    }

    .image-gallery-actions {
        position: relative;
        width: calc(100% + 2 * var(--st-horizontal-padding, 40px));
        overflow-x: auto;
        padding: 15px 0; // spacing for scrollbar
        margin: 0 calc(-1 * var(--st-horizontal-padding, 40px)); // Allow overflow

        &::-webkit-scrollbar {
            display: none;
        }
        /* Firefox */
        scrollbar-width: none;

        /* IE / old Edge */
        -ms-overflow-style: none;

        .button {
            transition: opacity .2s ease-out;
            position: absolute;

            &:first-child {
                left: 0px;
            }

            &:last-child {
                right: 0px;
            }

            &.hide {
                opacity: 0;
                pointer-events: none;
            }
        }

        .thumbnails-container {
            display: inline-flex;
            justify-content: center;
            padding: 0 var(--st-horizontal-padding, 40px);
            max-width: none;
            min-width: 100%;
            box-sizing: border-box;
        }

        .thumbnails {
            display: inline-flex;
            gap: 5px;

            .thumbnail {
                border-radius: $border-radius;
                border: $border-width solid $color-border-shade;
                background: $color-current-background;
                background: var(--color-input-background, #{$color-current-background});
                border-radius: $border-radius;
                outline:  1px solid transparent;
                transition: border-color 0.2s, outline-color 0.2s;
                @extend %style-input-shadow;

                cursor: pointer;
                display: grid;
                place-content: center;
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
                user-select: none;
                color: inherit;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                //contain: style paint;

                &:link, &:visited, &:active, &:hover {
                    text-decoration: none;
                }

                transition: border-color .2s ease-out;

                @media (hover: hover) {
                    &:hover {
                        border-color: $color-primary-gray-light;
                        outline-color: $color-primary-gray-light;
                    }
                }

                &:active {
                    border-color: $color-primary-gray-light;
                    outline-color: $color-primary-gray-light;
                }

                &.active {
                    border-color: $color-primary;
                    outline-color: $color-primary;
                }

                img {
                    object-fit: contain;
                    border-radius: $border-radius - 5px;
                    touch-action: none;
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    user-select: none;
                    -webkit-user-drag: none;
                }

                .image-component {
                    margin: 5px;
                    height: 48px;
                    width: 48px;
                }

            }
        }
    }
    .image {
        width: 100%;
        border-radius: $border-radius;
    }
}

</style>
