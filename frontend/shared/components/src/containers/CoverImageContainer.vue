<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div v-if="platform.config.coverPhoto" class="cover-image-container">
        <div class="left">
            <ImageComponent :image="platform.config.coverPhoto" class="cover-image" />
            <ImageComponent v-if="platform.config.coverBottomLeftOverlayImage" :image="platform.config.coverBottomLeftOverlayImage" class="overlay" :auto-height="true" :style="'width: ' + platform.config.coverBottomLeftOverlayWidth + 'px'" />
        </div>
        <div class="right">
            <ComponentWithPropertiesInstance :key="root.key" :component="root" />
        </div>
    </div>
    <ComponentWithPropertiesInstance v-else :key="root.key" :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { usePlatform } from '../hooks';
import ImageComponent from '../views/ImageComponent.vue';

const props = defineProps<{
    root: ComponentWithProperties;
}>();

const platform = usePlatform();

defineExpose({
    shouldNavigateAway: async () => {
        return await props.root.shouldNavigateAway();
    },
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.cover-image-container {
    > .left {
        background: $color-background-shade;
        display: none;
        position: relative;

        .cover-image {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;

            img {
                object-fit: cover;
            }
        }

        .overlay {
            position: absolute;
            left: 0;
            bottom: 0;
            max-width: 100%;
        }

    }
}

@media (min-width: 1000px) {
    .cover-image-container {
        display: grid;
        grid-template-columns: 60vw 40vw;

        > .left {
            display: block;
        }

        > .right {
            --vw: 0.4vw;
            --st-horizontal-padding: var(--split-view-detail-horizontal-padding, 40px);
            --navigation-bar-horizontal-padding: 20px;

            overflow: clip;

            .st-view {
                .st-view-vertical-center {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;

                    > .container {
                        width: 100%;
                    }
                }
            }
        }
    }
}

</style>
