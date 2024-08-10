<template>
    <figure class="organization-avatar">
        <div v-if="logo" class="logo">
            <ImageComponent :image="logo" />
        </div>
        <div v-else v-color="organization.meta.color" class="letter-logo" :data-length="letters.length">
            {{ letters }}
        </div>
    </figure>
</template>

<script lang="ts" setup>
import { Organization } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { ImageComponent } from "@stamhoofd/components";
import { computed } from "vue";
const props = defineProps<{
    organization: Organization
}>()

const letters = computed(() => Formatter.firstLetters(props.organization.name, 3))
const logo = computed(() => props.organization.meta.squareLogo)
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.organization-avatar {
    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        text-align: center;
        background: $color-primary-light;
        color: $color-primary-dark;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-size: calc(var(--block-width, 40px) * 0.40);
        font-weight: bold;
        position: relative;

        &[data-length="2"] {
            font-size: calc(var(--block-width, 40px) * 0.32);
        }

        &[data-length="3"] {
            font-size: calc(var(--block-width, 40px) * 0.32);
            letter-spacing: -0.5px;
        }
    }

    .logo {
        .image-component {
            width: var(--block-width, 40px);
            height: var(--block-width, 40px);
            object-fit: contain;
        }
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        overflow: hidden;
        position: relative;

        &::after {
            border-radius: 12px;
            content: '';
            display: block;
            height: 100%;
            position: absolute;
            top: 0;
            width: 100%;
        }
    }
}
</style>
