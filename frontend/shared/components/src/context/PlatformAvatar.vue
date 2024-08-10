<template>
    <figure v-if="logo" class="organization-avatar">
        <div class="logo">
            <ImageComponent :image="logo" :image-dark="logoDark" />
        </div>
    </figure>
    <Logo v-else class="small" />
</template>

<script lang="ts" setup>
import { ImageComponent, Logo, usePlatform } from "@stamhoofd/components";
import { computed } from "vue";

const platform = usePlatform()
const logo = computed(() => platform.value.config.squareLogo ?? platform.value.config.horizontalLogo)
const logoDark = computed(() => platform.value.config.squareLogoDark ?? platform.value.config.horizontalLogoDark)

</script>
