<template>
    <figure class="group-avatar">
        <div v-if="logoSrc" class="logo">
            <img :src="logoSrc" :srcset="logoSrcSet">
        </div>
        <div v-else class="letter-logo" :data-length="letters.length">
            {{ letters }}
        </div>
    </figure>
</template>

<script lang="ts">
import { Group } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class GroupAvatar extends Vue {
    @Prop({ required: true })
        group!: Group

    get letters() {
        return Formatter.firstLetters(this.group.settings.name, 2)
    }

    get logoSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(24, 24)
    }

    get logoSrcSet() {
        if (!this.group.settings.squarePhoto && !this.group.settings.coverPhoto) {
            return null
        }
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)!.getPathForSize(24, 24) + " 1x, "+(this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)!.getPathForSize(24*2, 24*2)+" 2x, "+(this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)!.getPathForSize(24*3, 24*3)+" 3x"
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;

.group-avatar {
    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        text-align: center;
        background: $color-primary-light;
        color: $color-primary;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-size: 11px;
        font-weight: bold;
        position: relative;
    }

    .logo {
        img {
            width: var(--block-width, 40px);
            height: var(--block-width, 40px);
            object-fit: contain;
        }
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        overflow: hidden;
        //background: $color-background;
        //box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.05), 0px 2px 15px rgba(0, 0, 0, 0.05);
        position: relative;

        &::after {
            border-radius: 12px;
            // inset box shadow doesn't work over img tags
            //box-shadow: inset 0px 0px 0px 2px rgba(0, 0, 0, 0.2);
            content: '';
            display: block;
            height: 100%;
            position: absolute;
            top: 0;
            width: 100%;

            mix-blend-mode: luminosity;
        }
    }
}
</style>