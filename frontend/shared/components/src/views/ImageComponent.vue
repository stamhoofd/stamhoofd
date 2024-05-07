<template>
    <div class="image-component" :style="{maxHeight: maxHeight ? maxHeight+'px' : null}">
        <div v-if="autoHeight" class="sizer" :style="sizerStyle">
            <div :style="sizerChildStyle" />
        </div>
        <img v-if="elWidth" :src="src" :width="imgWidth" :height="imgHeight">
    </div>
</template>

<script lang="ts">
import { Image } from '@stamhoofd/structures';
import { Component, Prop, Vue } from '@simonbackx/vue-app-navigation/classes';


@Component({})
export default class ImageComponent extends Vue {
    @Prop({ required: true })
        image: Image

    /**
     * Update the height to match the image resolution.
     * Width will take the available space (can style this with css)
     */
    @Prop({ default: false })
        autoHeight: boolean

    @Prop({ default: null })
        maxHeight: number|null

    elWidth: number|null = null;
    elHeight: number|null = null;

    get resolution() {
        return this.image.getResolutionForSize(this.elHeight ?? undefined, this.elHeight ?? undefined)
    }

    get imgWidth() {
        return this.resolution.width
    }

    get imgHeight() {
        return this.resolution.height
    }

    get src() {
        return this.resolution.file.getPublicPath();
    }

    updateSize() {
        this.elWidth = (this.$el as HTMLElement).offsetWidth
        this.elHeight = this.autoHeight ? null : (this.$el as HTMLElement).offsetHeight
    }

    get sizerChildStyle() {
        if (!this.autoHeight) {
            return;
        }
        const percentage = (this.imgHeight / this.imgWidth * 100).toFixed(2);
        return `padding-bottom: ${percentage}%;`
    }

    get sizerStyle() {
        if (!this.autoHeight) {
            return;
        }
        return `max-height: ${this.imgHeight}px;`
    }

    // Observe the size of the element and update the used resolution accordingly
    mounted() {
        // Create a size observer
        try {
            const resizeObserver = new ResizeObserver(() => {
                this.updateSize();
            });
            resizeObserver.observe(this.$el);
        } catch (e) {
            // Not supported
            this.$nextTick(() => {
                this.updateSize();
            })
        }
    }
}
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