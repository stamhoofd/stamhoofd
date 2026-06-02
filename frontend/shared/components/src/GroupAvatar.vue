<template>
    <figure class="group-avatar">
        <div v-if="logoSrc" class="logo">
            <img :src="logoSrc" :srcset="logoSrcSet">
        </div>
        <span v-else-if="allowEmpty" class="icon gray" />
        <div v-else v-color="group.id" class="letter-logo" :data-length="letters.length">
            {{ letters }}
        </div>
    </figure>
</template>

<script lang="ts" setup>
import type { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    group: Group;
    allowEmpty?: boolean;
}>(), {
    allowEmpty: false,
});

const letters = computed(() => Formatter.firstLetters(props.group.settings.name, 2));

const logoSrc = computed(() => props.group.settings.squarePhoto?.getPathForSize(24, 24));

const logoSrcSet = computed(() => {
    if (!props.group.settings.squarePhoto) {
        return undefined;
    }
    const photo = props.group.settings.squarePhoto;
    return photo.getPathForSize(24, 24) + ' 1x, ' + photo.getPathForSize(24 * 2, 24 * 2) + ' 2x, ' + photo.getPathForSize(24 * 3, 24 * 3) + ' 3x';
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.group-avatar {
    user-select: none;

    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: min($border-radius, var(--block-width, 40px) / 4);
        text-align: center;
        background: $color-primary-light;
        color: $color-primary-dark;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-weight: $font-weight-bold;
        position: relative;
        text-box-trim: trim-both;

        font-size: min(calc(var(--block-width, 40px) / 2.5), 14px);

        &[data-length="1"] {
            font-size: min(calc(var(--block-width, 40px) / 2), 14px);
        }
    }

    .logo {
        img {
            width: var(--block-width, 40px);
            height: var(--block-width, 40px);
            object-fit: contain;
        }
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        //margin: -5px 0;
        border-radius: min($border-radius, var(--block-width, 40px) / 4);
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
