<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div v-if="platform.config.coverPhoto" class="cover-image-container">
        <div class="left">
            <ImageComponent :image="platform.config.coverPhoto" />
        </div>
        <div class="right">
            <ComponentWithPropertiesInstance :key="root.key" :component="root" />
        </div>
    </div>
    <ComponentWithPropertiesInstance v-else :key="root.key" :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { usePlatform } from "../hooks";
import ImageComponent from "../views/ImageComponent.vue";

const props = defineProps<{
    root: ComponentWithProperties
}>();

const platform = usePlatform()

defineExpose({
    shouldNavigateAway: async () => {
        return await props.root.shouldNavigateAway()
    }
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.cover-image-container {
    > .left {
        background: $color-background-shade;
        display: none;
        position: relative;

        .image-component {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;

            img {
                object-fit: cover;
            }
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
                > main.allow-vertical-center {
                    flex-grow: 0;
                    margin-top: auto;
                    margin-bottom: auto;
                }
            }
        }
    }
}

</style>
