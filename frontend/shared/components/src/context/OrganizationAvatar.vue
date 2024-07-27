<template>
    <figure ref="el" class="organization-avatar">
        <div v-if="logo" class="logo">
            <ImageComponent :image="logo" />
        </div>
        <div v-else class="letter-logo" :data-length="letters.length">
            {{ letters }}
        </div>
    </figure>
</template>

<script lang="ts" setup>
import { Organization } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { computed, ref, watchEffect } from "vue";
import { ColorHelper } from "../ColorHelper";
import { ImageComponent } from "@stamhoofd/components";
const props = defineProps<{
    organization: Organization
}>()

const letters = computed(() => Formatter.firstLetters(props.organization.name, 3))
const logo = computed(() => props.organization.meta.squareLogo)
const el = ref<HTMLElement|null>(null)

watchEffect(() => {
    if (props.organization.meta.color && el.value) {
        ColorHelper.setColor(props.organization.meta.color, el.value);
    }
})
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
